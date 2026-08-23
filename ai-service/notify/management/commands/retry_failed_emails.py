"""
Management command: retry_failed_emails

Retries EmailLog rows whose next_retry_at <= now() and status='FAILED' and attempts < 5.
Intended to be run every 5 minutes via a cron job.

Usage:
    python manage.py retry_failed_emails
"""

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

from notify.models import EmailLog
from notify.email_service import retry_log

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Retry failed email logs that are due for retry."

    def handle(self, *args, **options):
        now = timezone.now()
        due = EmailLog.objects.filter(
            status="FAILED",
            next_retry_at__lte=now,
            attempts__lt=5,
        )
        count = 0

        for log in due:
            logger.info("Retrying email log %s (attempt %d)", log.id, log.attempts + 1)
            retry_log(log)
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Retried {count} failed email logs."))
