"""
Management command: send_due_reminders

Sends any MedicationReminder rows where scheduled_at <= now() and status='PENDING'.
Intended to be run every 5 minutes via a cron job.

Usage:
    python manage.py send_due_reminders
"""

import logging
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from notify.models import MedicationReminder

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Send due medication reminders."

    def handle(self, *args, **options):
        now = timezone.now()
        due = MedicationReminder.objects.filter(
            scheduled_at__lte=now,
            status="PENDING",
        )
        count = 0

        for reminder in due:
            try:
                send_mail(
                    subject=f"Medication reminder: {reminder.medication_name}",
                    message=(
                        f"This is a reminder to take your medication: {reminder.medication_name}.\n"
                        f"Scheduled time: {reminder.scheduled_at}\n\n"
                        "Healthcare Manager"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[reminder.patient_email],
                    fail_silently=False,
                )
                reminder.status = "SENT"
                reminder.sent_at = timezone.now()
            except Exception as exc:
                reminder.status = "FAILED"
                logger.warning("Failed to send reminder %s: %s", reminder.id, exc)
            finally:
                reminder.save()
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Processed {count} due medication reminders."))
