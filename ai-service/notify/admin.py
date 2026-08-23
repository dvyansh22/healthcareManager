from django.contrib import admin
from .models import MedicationReminder, EmailLog, LlmCallLog


@admin.register(MedicationReminder)
class MedicationReminderAdmin(admin.ModelAdmin):
    list_display = ("id", "patient_email", "medication_name", "scheduled_at", "status", "sent_at")
    list_filter = ("status",)
    search_fields = ("patient_email", "medication_name")
    ordering = ("scheduled_at",)


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "type", "status", "attempts", "next_retry_at", "created_at")
    list_filter = ("type", "status")
    search_fields = ("recipient",)
    ordering = ("-created_at",)


@admin.register(LlmCallLog)
class LlmCallLogAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment_id", "call_type", "status", "created_at")
    list_filter = ("call_type", "status")
    search_fields = ("appointment_id",)
    ordering = ("-created_at",)
