# SYSTEM_DESIGN.md — Healthcare Appointment & Follow-up Manager

## Architecture Overview

The system is a **polyglot microservice** composed of three services sharing one PostgreSQL database (two schemas):

| Service | Stack | Responsibility |
|---|---|---|
| `web` | Next.js 14, TypeScript, Tailwind | Frontend for all 3 roles |
| `api-core` | ASP.NET Core 8, EF Core | Auth, booking, schedules, calendar |
| `ai-service` | Django + DRF | LLM summaries, email notifications, reminders |

The split exists for a clear reason: `api-core` is **Postgres-transaction-heavy and safety-critical** (double-booking prevention, leave cascade), while `ai-service` is **I/O-heavy and failure-tolerant** (LLM calls can fail gracefully, emails can retry). Mixing these would couple SLA-critical booking to flaky external APIs.

---

## Double-Booking Prevention

The booking flow uses a **two-phase hold → confirm** mechanism:

1. **Hold phase** (`POST /api/appointments/hold`): The patient claims a slot by inserting a `slot_holds` row using `INSERT ... ON CONFLICT DO NOTHING`. The `(doctor_id, slot_start)` unique index on `slot_holds` ensures only one patient can hold a given slot at a time. If the insert produces zero rows (conflict), a `409` is returned immediately — no slot is held.

2. **Confirm phase** (`POST /api/appointments/confirm`): Inside a database transaction, the hold is verified (ownership + expiry), deleted, and an `appointments` row is inserted. The `appointments` table has a **partial unique index** on `(doctor_id, slot_start) WHERE status != 'Cancelled'`, enforced at the database level by PostgreSQL. If two concurrent confirms race past the hold check, only one can insert the appointment row; the other gets a unique-constraint violation, which the API maps to `409 "Slot was booked by someone else"`.

This two-level guard (hold uniqueness + appointment constraint) makes double-booking **impossible** even under high concurrency, and is verified by an automated xUnit test that fires 10 concurrent requests at the same slot.

---

## Slot Hold Mechanism

Holds expire automatically after **10 minutes** (configurable). A background `SlotCleanupService` (`IHostedService`) runs every 60 seconds and deletes `slot_holds` rows where `expires_at < now()`. This frees slots for other patients if the current holder abandons the booking flow. Expired holds are also rejected at confirm time (server-side check), so there is no race between the cleanup service and a late confirm.

---

## Doctor Leave Cascade Cancellation

When an admin marks a doctor on leave for a date:

1. A **single database transaction** inserts the `doctor_leaves` row and bulk-updates all `Confirmed` appointments for that doctor on that date to `status = LeaveCancelled`.
2. After the transaction commits (the leave and cancellations are persisted regardless of what follows), `api-core` **fire-and-forgets** two async operations:
   - Deletes associated Google Calendar events (best-effort).
   - Calls `ai-service`'s `/internal/notify/leave-cancellation` with the affected appointment IDs.
3. If `ai-service` is unreachable, the call is logged locally and silently dropped — the leave and cancellations remain committed. Patients may not receive emails in this scenario, but the booking data is correct.

---

## Notification Failure & Retry Handling

All email sends in `ai-service` create an `email_logs` row before attempting delivery. The backoff schedule is: immediate → +5 min → +30 min → +2 h → +12 h (max 5 attempts). A failed send sets `status=FAILED` and `next_retry_at` accordingly. The `retry_failed_emails` Django management command (run every 5 minutes via external cron) queries `email_logs` rows due for retry and re-attempts delivery. After 5 failures, `status=FAILED` permanently and the row is visible in Django admin for manual review.

This design means booking-critical operations (hold, confirm, cancel, leave cascade) never block on email and always succeed even if the SMTP server is down.

---

## LLM Failure Handling

All Gemini calls in `ai-service` are wrapped in `try/except` with a timeout. On any error (timeout, bad JSON, API quota), the LLM call is logged to `llm_call_logs` with `status=FAILED` and a **fallback body** is returned as HTTP 200. `api-core` treats the LLM call as always-succeeding (stores whatever JSON it receives). This ensures that booking and note-submission always complete successfully even when the Gemini API is unavailable.

---

*Document length: ~660 words*
