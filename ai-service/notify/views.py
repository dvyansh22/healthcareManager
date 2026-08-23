import json
import logging
from datetime import timedelta, datetime, timezone as dt_timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .authentication import ServiceTokenAuthentication
from .llm import call_pre_visit, call_post_visit
from .email_service import send_email_with_log
from .models import MedicationReminder, EmailLog

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_appointment_data(appointment_id: str) -> dict | None:
    """
    Read appointment + user data from the core schema (read-only).
    Uses raw SQL with quoted PascalCase columns to match EF Core's Postgres schema.
    """
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a."Id",
                a."PatientId",
                a."DoctorId",
                a."SlotStart",
                a."SlotEnd",
                a."SymptomText",
                a."Status",
                p."Email"  AS patient_email,
                p."Name"   AS patient_name,
                du."Email" AS doctor_email,
                du."Name"  AS doctor_name
            FROM core.appointments a
            JOIN core.users p  ON p."Id" = a."PatientId"
            JOIN core.doctor_profiles dp ON dp."Id" = a."DoctorId"
            JOIN core.users du ON du."Id" = dp."UserId"
            WHERE a."Id" = %s
            """,
            [str(appointment_id)],
        )
        row = cursor.fetchone()

    if not row:
        return None

    cols = [
        "id", "patient_id", "doctor_id", "slot_start", "slot_end",
        "symptom_text", "status", "patient_email", "patient_name",
        "doctor_email", "doctor_name",
    ]
    return dict(zip(cols, row))


def _get_prescriptions(appointment_id: str) -> list[dict]:
    """Read prescriptions from core schema."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT "Id", "MedicationName", "Dosage", "FrequencyPerDay", "DurationDays", "StartDate"
            FROM core.prescriptions
            WHERE "AppointmentId" = %s
            """,
            [str(appointment_id)],
        )
        rows = cursor.fetchall()

    cols = ["id", "medication_name", "dosage", "frequency_per_day", "duration_days", "start_date"]
    return [dict(zip(cols, row)) for row in rows]



def _compute_reminder_times(start_date, frequency_per_day: int, duration_days: int) -> list:
    """
    Compute scheduled_at times for each dose across duration_days.
    Evenly spaces doses within each day (06:00–22:00 window).
    """
    times = []
    dose_interval_hours = 24 / frequency_per_day

    for day in range(duration_days):
        base = datetime(
            start_date.year, start_date.month, start_date.day,
            6, 0, 0, tzinfo=dt_timezone.utc
        ) + timedelta(days=day)
        for dose in range(frequency_per_day):
            scheduled = base + timedelta(hours=dose_interval_hours * dose)
            times.append(scheduled)

    return times


# ---------------------------------------------------------------------------
# LLM endpoints
# ---------------------------------------------------------------------------

class PreVisitLlmView(APIView):
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_id = request.data.get("appointmentId")
        symptom_text = request.data.get("symptomText", "")
        if not appointment_id:
            raise ValidationError({"appointmentId": "required"})

        result = call_pre_visit(str(appointment_id), symptom_text or "")
        return Response(result)


class PostVisitLlmView(APIView):
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_id = request.data.get("appointmentId")
        clinical_notes = request.data.get("clinicalNotes", "")
        if not appointment_id:
            raise ValidationError({"appointmentId": "required"})

        result = call_post_visit(str(appointment_id), clinical_notes or "")
        return Response(result)


# ---------------------------------------------------------------------------
# Notification endpoints
# ---------------------------------------------------------------------------

class NotifyBookingConfirmedView(APIView):
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_id = request.data.get("appointmentId")
        appt = _get_appointment_data(str(appointment_id))
        if not appt:
            return Response({"error": "Appointment not found in core schema"}, status=404)

        subject = "Your appointment has been confirmed"
        body = (
            f"Dear {appt['patient_name']},\n\n"
            f"Your appointment with Dr. {appt['doctor_name']} has been confirmed.\n"
            f"Date & Time: {appt['slot_start']}\n\n"
            "Please arrive 10 minutes early.\n\nHealthcare Manager"
        )
        send_email_with_log(
            appointment_id=str(appointment_id),
            recipient=appt["patient_email"],
            email_type="BOOKING_CONFIRM",
            subject=subject,
            body=body,
        )
        send_email_with_log(
            appointment_id=str(appointment_id),
            recipient=appt["doctor_email"],
            email_type="BOOKING_CONFIRM",
            subject="New Appointment Confirmed",
            body=f"Dear Dr. {appt['doctor_name']},\n\nA new appointment has been booked with {appt['patient_name']}.\nDate & Time: {appt['slot_start']}\n\nHealthcare Manager",
        )
        return Response({"status": "queued"})


class NotifyCancellationView(APIView):
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_id = request.data.get("appointmentId")
        appt = _get_appointment_data(str(appointment_id))
        if not appt:
            return Response({"error": "Appointment not found"}, status=404)

        subject = "Your appointment has been cancelled"
        body = (
            f"Dear {appt['patient_name']},\n\n"
            f"Your appointment with Dr. {appt['doctor_name']} "
            f"on {appt['slot_start']} has been cancelled.\n\n"
            "Please rebook at your convenience.\n\nHealthcare Manager"
        )
        send_email_with_log(
            appointment_id=str(appointment_id),
            recipient=appt["patient_email"],
            email_type="CANCELLATION",
            subject=subject,
            body=body,
        )
        send_email_with_log(
            appointment_id=str(appointment_id),
            recipient=appt["doctor_email"],
            email_type="CANCELLATION",
            subject="Appointment Cancelled",
            body=f"Dear Dr. {appt['doctor_name']},\n\nYour appointment with {appt['patient_name']} on {appt['slot_start']} has been cancelled.\n\nHealthcare Manager",
        )
        return Response({"status": "queued"})


class NotifyLeaveCancellationView(APIView):
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_ids = request.data.get("appointmentIds", [])
        if not appointment_ids:
            return Response({"status": "no appointments"})

        for appt_id in appointment_ids:
            appt = _get_appointment_data(str(appt_id))
            if not appt:
                logger.warning("Appointment %s not found for leave cancellation notify", appt_id)
                continue

            subject = "Your appointment has been cancelled due to doctor leave"
            body = (
                f"Dear {appt['patient_name']},\n\n"
                f"We regret to inform you that your appointment with Dr. {appt['doctor_name']} "
                f"on {appt['slot_start']} has been cancelled because the doctor is on leave.\n\n"
                "Please rebook at your earliest convenience. We apologise for the inconvenience.\n\n"
                "Healthcare Manager"
            )
            send_email_with_log(
                appointment_id=str(appt_id),
                recipient=appt["patient_email"],
                email_type="LEAVE_NOTICE",
                subject=subject,
                body=body,
            )
            send_email_with_log(
                appointment_id=str(appt_id),
                recipient=appt["doctor_email"],
                email_type="LEAVE_NOTICE",
                subject="Appointment Cancelled due to Leave",
                body=f"Dear Dr. {appt['doctor_name']},\n\nYour appointment with {appt['patient_name']} on {appt['slot_start']} has been automatically cancelled due to your registered leave.\n\nHealthcare Manager",
            )

        return Response({"status": "queued", "count": len(appointment_ids)})


class NotifyBookingCompletedView(APIView):
    """Schedules medication reminders after a consultation is completed."""
    authentication_classes = [ServiceTokenAuthentication]

    def post(self, request):
        appointment_id = request.data.get("appointmentId")
        appt = _get_appointment_data(str(appointment_id))
        if not appt:
            return Response({"error": "Appointment not found"}, status=404)

        prescriptions = _get_prescriptions(str(appointment_id))
        created_count = 0

        for rx in prescriptions:
            times = _compute_reminder_times(
                rx["start_date"],
                rx["frequency_per_day"],
                rx["duration_days"],
            )
            for scheduled_at in times:
                MedicationReminder.objects.create(
                    appointment_id=str(appointment_id),
                    prescription_id=str(rx["id"]),
                    patient_email=appt["patient_email"],
                    medication_name=rx["medication_name"],
                    scheduled_at=scheduled_at,
                    status="PENDING",
                )
                created_count += 1

        return Response({"status": "reminders_scheduled", "count": created_count})
