import uuid
from django.db import models


class MedicationReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment_id = models.UUIDField()
    prescription_id = models.UUIDField()
    patient_email = models.EmailField()
    medication_name = models.CharField(max_length=255)
    scheduled_at = models.DateTimeField()
    status = models.CharField(max_length=20, default="PENDING")  # PENDING/SENT/FAILED
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "medication_reminders"


class EmailLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment_id = models.UUIDField(null=True, blank=True)
    recipient = models.EmailField()
    type = models.CharField(max_length=30)  # BOOKING_CONFIRM/REMINDER/CANCELLATION/LEAVE_NOTICE
    status = models.CharField(max_length=20, default="PENDING")
    attempts = models.IntegerField(default=0)
    last_error = models.TextField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "email_logs"


class LlmCallLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment_id = models.UUIDField()
    call_type = models.CharField(max_length=20)  # PRE_VISIT/POST_VISIT
    status = models.CharField(max_length=20)
    raw_response = models.TextField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "llm_call_logs"
