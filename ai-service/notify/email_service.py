import logging
from datetime import timedelta

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from notify.models import EmailLog

logger = logging.getLogger(__name__)

# Backoff schedule: attempt 1 immediate, then +5min, +30min, +2h, +12h
RETRY_DELAYS = [
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=12),
]
MAX_ATTEMPTS = 5

EMAIL_SUBJECTS = {
    "BOOKING_CONFIRM": "Your appointment has been confirmed",
    "CANCELLATION": "Your appointment has been cancelled",
    "LEAVE_NOTICE": "Your appointment was cancelled due to doctor leave",
    "REMINDER": "Medication reminder",
}


def send_email_with_log(
    *,
    appointment_id,
    recipient: str,
    email_type: str,
    subject: str,
    body: str,
):
    """
    Sends an email and creates/updates an EmailLog entry.
    On failure: sets status=FAILED with next_retry_at according to backoff schedule.
    """
    log = EmailLog.objects.create(
        appointment_id=appointment_id,
        recipient=recipient,
        type=email_type,
        status="PENDING",
    )
    _attempt_send(log, subject, body)


def retry_log(log: EmailLog):
    """Retry a previously failed EmailLog entry."""
    if log.attempts >= MAX_ATTEMPTS:
        logger.warning("EmailLog %s has reached max attempts, skipping.", log.id)
        return

    subject = EMAIL_SUBJECTS.get(log.type, "Healthcare notification")
    # Reconstruct a generic body — full retry would need stored template data.
    # For the retry path we re-send a short notice.
    body = f"This is a follow-up notification regarding your appointment (ref: {log.appointment_id})."
    _attempt_send(log, subject, body)


def _attempt_send(log: EmailLog, subject: str, body: str):
    log.attempts += 1
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[log.recipient],
            fail_silently=False,
        )
        log.status = "SENT"
        log.next_retry_at = None
        log.last_error = None
    except Exception as exc:
        log.status = "FAILED"
        log.last_error = str(exc)
        attempt_index = log.attempts - 1  # 0-based index into RETRY_DELAYS
        if attempt_index < len(RETRY_DELAYS):
            log.next_retry_at = timezone.now() + RETRY_DELAYS[attempt_index]
        else:
            log.next_retry_at = None  # No more retries
        logger.warning("Email send failed for log %s (attempt %d): %s", log.id, log.attempts, exc)

    log.save()
