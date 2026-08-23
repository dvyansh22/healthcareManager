from django.urls import path
from .views import (
    PreVisitLlmView,
    PostVisitLlmView,
    NotifyBookingConfirmedView,
    NotifyCancellationView,
    NotifyLeaveCancellationView,
    NotifyBookingCompletedView,
)

urlpatterns = [
    # LLM endpoints
    path("llm/pre-visit", PreVisitLlmView.as_view(), name="llm-pre-visit"),
    path("llm/post-visit", PostVisitLlmView.as_view(), name="llm-post-visit"),
    # Notification endpoints
    path("notify/booking-confirmed", NotifyBookingConfirmedView.as_view(), name="notify-booking-confirmed"),
    path("notify/cancellation", NotifyCancellationView.as_view(), name="notify-cancellation"),
    path("notify/leave-cancellation", NotifyLeaveCancellationView.as_view(), name="notify-leave-cancellation"),
    path("notify/booking-completed", NotifyBookingCompletedView.as_view(), name="notify-booking-completed"),
]
