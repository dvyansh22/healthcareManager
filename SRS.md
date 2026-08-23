# Software Requirements Specification
## Healthcare Appointment & Follow-up Manager

**Audience for this document:** an AI coding agent (e.g. Claude Code) that will implement this project end-to-end in the repository `healthcareManager`. Every section is written to be unambiguous and directly actionable. Where a decision has already been made, it is stated as a requirement, not a suggestion — do not silently deviate from it. Where the agent must make a judgment call, that is explicitly flagged.

---

## 1. Purpose & Scope

Build a full-stack Healthcare Appointment & Follow-up Manager with three user roles (Patient, Doctor, Admin), safe concurrent appointment booking, AI-generated pre-visit and post-visit summaries, automated email notifications with retry handling, medication reminders, and Google Calendar sync. The system is a polyglot microservice architecture of three services plus a shared database, detailed in §3.

Out of scope: payments/billing, video consultation, insurance handling, multi-clinic/multi-tenant support, mobile apps.

---

## 2. User Roles & Core User Stories

**Patient**
- Registers and logs in.
- Searches/browses doctors by specialization.
- Views a doctor's available slots (computed from working hours minus leaves minus existing bookings).
- Books a slot by holding it, entering symptoms, and confirming.
- Receives a pre-visit AI summary is generated (patient does not see the raw urgency/questions — those are for the doctor; patient sees a confirmation with appointment details).
- Views their appointment history and the post-visit summary + medication schedule once the doctor submits notes.
- Cancels an upcoming appointment.
- Receives email confirmation, cancellation notices, and medication reminders.

**Doctor**
- Logs in (accounts are created by Admin, doctors do not self-register).
- Sets/updates working hours and slot duration via profile.
- Views their schedule/upcoming appointments.
- Views the AI-generated pre-visit summary (urgency, chief complaint, suggested questions) before a consultation.
- After a consultation, submits clinical notes and prescriptions; the system generates a patient-friendly post-visit summary via AI.

**Admin**
- Creates/edits/deactivates Doctor accounts and profiles.
- Marks a doctor's leave for specific dates; any confirmed appointments on that date are automatically cancelled, calendar events removed, and patients notified.
- Views system-wide appointment and failed-notification logs (basic visibility, no fancy dashboard required — Django admin satisfies this for the notify-side logs; a simple list view suffices on the .NET side).

---

## 3. System Architecture (mandatory — do not restructure)

Three services + one shared PostgreSQL database, in a monorepo:

```
healthcareManager/
├── web/          # Next.js 14+ (App Router, TypeScript, Tailwind) — frontend for all 3 roles
├── api-core/     # ASP.NET Core 8 Web API + EF Core — auth, users, doctors, slots, appointments, calendar
├── ai-service/   # Django + DRF — LLM summaries, email, reminders, retry queue
├── docker-compose.yml   # local Postgres
└── README.md
```

- **Next.js** talks only to `api-core`. It never calls `ai-service` directly.
- **api-core** is the source of truth for auth (issues JWTs) and for all booking-critical data. It calls `ai-service` server-to-server for LLM summaries and to trigger notifications, using a static shared-secret header `X-Service-Token`, not the user's JWT.
- **ai-service** never writes to `api-core`'s tables. It has read-only DB access to the `core` schema (for reading appointment/prescription data it needs, e.g. for medication reminders) and full read/write access to its own `notify` schema.
- Shared Postgres, two schemas: `core` (owned/migrated by EF Core) and `notify` (owned/migrated by Django).

This split is intentional and must be preserved: `api-core` is Postgres-transaction-heavy and safety-critical (booking), `ai-service` is I/O-heavy and tolerant of failure (LLM calls, email). Do not merge them or move booking logic into Django.

---

## 4. Data Model

### `core` schema (EF Core / api-core)

```
users
  id UUID PK, email UNIQUE, password_hash, role ENUM(Patient,Doctor,Admin),
  name, phone NULLABLE, created_at

doctor_profiles
  id UUID PK, user_id UUID FK -> users UNIQUE, specialization, bio NULLABLE,
  working_hours_json TEXT  -- {"mon":{"start":"09:00","end":"17:00"}, ...}
  slot_duration_minutes INT DEFAULT 20

doctor_leaves
  id UUID PK, doctor_id UUID, leave_date DATE, reason NULLABLE
  UNIQUE(doctor_id, leave_date)

slot_holds
  id UUID PK, doctor_id UUID, slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ,
  patient_id UUID, expires_at TIMESTAMPTZ, created_at
  UNIQUE(doctor_id, slot_start)

appointments
  id UUID PK, patient_id UUID, doctor_id UUID, slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ,
  status ENUM(Confirmed,Cancelled,Completed,LeaveCancelled) DEFAULT Confirmed,
  symptom_text NULLABLE,
  pre_visit_summary_json NULLABLE, pre_visit_llm_status DEFAULT 'PENDING',
  post_visit_notes NULLABLE,
  post_visit_summary_json NULLABLE, post_visit_llm_status DEFAULT 'PENDING',
  patient_calendar_event_id NULLABLE, doctor_calendar_event_id NULLABLE,
  created_at, updated_at
  UNIQUE(doctor_id, slot_start) WHERE status != 'Cancelled'

prescriptions
  id UUID PK, appointment_id UUID FK -> appointments,
  medication_name, dosage NULLABLE, frequency_per_day INT, duration_days INT, start_date DATE

google_calendar_tokens
  id UUID PK, user_id UUID FK -> users UNIQUE, access_token, refresh_token, expiry_date
```

### `notify` schema (Django / ai-service)

```
medication_reminders
  id UUID PK, appointment_id UUID, prescription_id UUID, patient_email,
  medication_name, scheduled_at TIMESTAMPTZ, status DEFAULT 'PENDING', sent_at NULLABLE

email_logs
  id UUID PK, appointment_id UUID NULLABLE, recipient, type,
  status DEFAULT 'PENDING', attempts DEFAULT 0, last_error NULLABLE,
  next_retry_at NULLABLE, created_at

llm_call_logs
  id UUID PK, appointment_id UUID, call_type ENUM(PRE_VISIT,POST_VISIT),
  status, raw_response NULLABLE, error NULLABLE, created_at
```

---

## 5. Functional Requirements by Module

### 5.1 Auth (api-core)
- `POST /api/auth/register` — patient self-registration only. Hash password with bcrypt. Return JWT.
- `POST /api/auth/login` — any role. Return JWT containing `sub` (user id), `role`, `email`.
- JWT: HMAC-SHA256, secret from config, 120 min expiry (configurable).
- All other endpoints require `Authorization: Bearer <token>` and are role-guarded via middleware/attributes.
- Admin-created Doctor/Admin accounts: `POST /api/admin/users` (Admin-only) creates a user with a specified role and a temporary password.

### 5.2 Doctor & Availability (api-core)
- `GET /api/doctors?specialization=` — public list, no auth required, for browsing.
- `GET /api/doctors/:id/availability?date=YYYY-MM-DD` — computes free slots: iterate the doctor's working hours for that weekday in steps of `slot_duration_minutes`, exclude any date present in `doctor_leaves`, exclude any slot with an active `SlotHold` or non-cancelled `Appointment` at that `doctor_id`+`slot_start`.
- Admin: `POST/PUT /api/admin/doctors/:id` manage `DoctorProfile` (specialization, working hours, slot duration).
- Admin: `POST /api/admin/doctors/:id/leave` — creates `DoctorLeave`. In the same DB transaction: find all `Confirmed` appointments for that doctor on that date, set `status = LeaveCancelled`. After the transaction commits, asynchronously (fire-and-forget with a short timeout, must not block the HTTP response): (a) delete the associated Google Calendar events for each affected appointment, (b) call `ai-service`'s `POST /internal/notify/leave-cancellation` with the list of affected appointment IDs so patients get emailed. If `ai-service` is unreachable, log locally and do not fail the admin's request — the leave and cancellations are already persisted.

### 5.3 Booking Flow (api-core) — the safety-critical path
1. `POST /api/appointments/hold { doctorId, slotStart }` (Patient) — attempt `INSERT INTO slot_holds ... ON CONFLICT (doctor_id, slot_start) DO NOTHING` with `expires_at = now() + 10 minutes`. If no row inserted (conflict), return `409 { error: "Slot no longer available" }`. Else return `{ holdId, expiresAt }`.
2. `POST /api/appointments/confirm { holdId, symptomText }` (Patient) — in a transaction: verify the hold exists, is not expired, and belongs to the requesting patient; delete the hold; insert the `Appointment` row (`status=Confirmed`). The `appointments` unique constraint on `(doctor_id, slot_start) WHERE status != 'Cancelled'` is the final guard against races. If the insert violates the constraint, return `409`.
3. After the transaction commits: call `ai-service`'s `POST /internal/llm/pre-visit { appointmentId, symptomText }` synchronously with a reasonable timeout (~15s); store the returned JSON into `pre_visit_summary_json` and set `pre_visit_llm_status` accordingly (`SUCCESS`/`FAILED` — note ai-service always returns 200 with a usable fallback body per §5.5, so this call effectively cannot fail the request, only take the fallback content). Then call Google Calendar to create the event (see §5.6), storing event IDs. Then fire-and-forget call `ai-service`'s `POST /internal/notify/booking-confirmed { appointmentId }`.
4. `GET /api/appointments/mine` (Patient/Doctor, filtered by their own id) — list appointments with role-appropriate fields (patient does not receive `pre_visit_summary_json`'s urgency/questions in the response payload — that is doctor-only; patient sees status, time, doctor name, and post-visit summary once available).
5. `POST /api/appointments/:id/cancel` (Patient or Doctor, must own the appointment) — set `status=Cancelled` in a transaction, then fire-and-forget delete calendar events and call `ai-service`'s cancellation notify endpoint.

**Concurrency requirement (must be verified, not just implemented):** write and run a test/script that fires at least 10 concurrent `confirm` requests at the same `doctorId`+`slotStart` and asserts exactly one succeeds. Include this as an automated test in `api-core`'s test project, not just a manual curl script.

### 5.4 Doctor Notes / Post-visit (api-core)
- `POST /api/appointments/:id/notes` (Doctor, must own the appointment) — body: `{ clinicalNotes, prescriptions: [{ medicationName, dosage, frequencyPerDay, durationDays, startDate }] }`. Persist notes and prescriptions in a transaction, set `status=Completed`. After commit: call `ai-service`'s `POST /internal/llm/post-visit { appointmentId, clinicalNotes }`, store result into `post_visit_summary_json`/`post_visit_llm_status`. Fire-and-forget call `ai-service`'s `POST /internal/notify/booking-completed` (or reuse an appropriate endpoint) so medication reminders get scheduled — see §5.5.

### 5.5 LLM & Notifications (ai-service)
All endpoints under `/internal/*` require header `X-Service-Token` matching `settings.SERVICE_TOKEN`; return 401 otherwise.

- `POST /internal/llm/pre-visit { appointmentId, symptomText }` → Gemini call (see §6 for exact prompt/model), returns `{ urgency, chief_complaint, questions[] }`. On any exception (timeout, bad JSON, API error): log to `llm_call_logs` with `status=FAILED`, and still return HTTP 200 with fallback `{ urgency: "Unknown", chief_complaint: symptomText[:150], questions: [] }`. Never return a non-200 for an LLM failure — the caller must always get a usable body.
- `POST /internal/llm/post-visit { appointmentId, clinicalNotes }` → same pattern, returns `{ summary_text, medication_schedule[], follow_up_steps[] }`, fallback `{ summary_text: clinicalNotes, medication_schedule: [], follow_up_steps: [] }`.
- `POST /internal/notify/booking-confirmed { appointmentId }` — read appointment + patient/doctor emails from `core` schema (read-only), write an `email_logs` row, attempt send via Django's email backend; on failure set `status=FAILED`, `next_retry_at` with backoff, on success `status=SENT`.
- `POST /internal/notify/cancellation { appointmentId }` — same pattern, cancellation template.
- `POST /internal/notify/leave-cancellation { appointmentIds: [...] }` — same pattern per appointment, leave-notice template.
- `POST /internal/notify/booking-completed { appointmentId }` — reads the appointment's prescriptions from `core` (read-only), creates one `medication_reminders` row per prescription per scheduled dose (compute `scheduled_at` times across `duration_days` at `frequency_per_day` even intervals, starting `start_date`).

**Backoff schedule for email retries:** attempt 1 immediate, then retry at +5min, +30min, +2h, +12h; after 5 failed attempts, leave `status=FAILED` permanently (visible in Django admin for manual review).

### 5.6 Google Calendar (api-core)
- One clinic-owned Google account, OAuth2-connected once (a setup script/endpoint stores its `refresh_token` in `google_calendar_tokens`, keyed to a well-known "system" user row, or a dedicated config value — agent's choice, document whichever is chosen in the README).
- On booking confirm: create a Calendar event with `attendees: [patientEmail, doctorEmail]`, `sendUpdates: "all"`, store the returned event id split as `patient_calendar_event_id`/`doctor_calendar_event_id` (can be the same event id for both since both are attendees on one event — only need one field in practice, but the schema keeps both for flexibility if you choose to create two events instead; agent should default to **one shared event** unless there's a clear reason not to).
- On cancel or leave-cascade-cancel: delete the event.

### 5.7 Background Jobs
- **api-core**: an ASP.NET Core `IHostedService`/`BackgroundService` that runs every 60 seconds and deletes `slot_holds` rows where `expires_at < now()`.
- **ai-service**: two Django management commands, `send_due_reminders` (sends any `medication_reminders` where `scheduled_at <= now()` and `status='PENDING'`, updates status) and `retry_failed_emails` (retries `email_logs` rows due for retry per the backoff schedule). Both are intended to be triggered externally every 5 minutes (a hosting-platform cron job in production; for local dev, the agent should also provide a simple way to run them manually, e.g. documented in README).

---

## 6. LLM Integration Details (must match exactly)

**Provider:** Google Gemini via the `google-genai` Python SDK. **Model:** `gemini-flash-lite-latest` (free tier). API key from `GEMINI_API_KEY` env var, obtained from Google AI Studio (`https://aistudio.google.com/apikey`) — no billing account required for this tier.

Call pattern: `client.models.generate_content(model=MODEL, contents=prompt, config={"response_mime_type": "application/json"})`, then `json.loads(response.text)`.

**Pre-visit prompt:**
```
You are a clinical intake assistant. Respond ONLY with valid JSON, no markdown.
Analyse these symptoms and return JSON with keys "urgency" (Low/Medium/High),
"chief_complaint" (string), and "questions" (array of exactly 3 strings —
suggested questions for the doctor to ask). Symptoms: <symptomText>
```

**Post-visit prompt:**
```
You are a patient communication assistant. Respond ONLY with valid JSON, no markdown.
Convert these clinical notes into JSON with keys "summary_text" (plain-language
paragraph), "medication_schedule" (array of {name, dosage, frequency, duration}),
and "follow_up_steps" (array of strings). Notes: <clinicalNotes>
```

Both must be wrapped with a timeout and try/except as described in §5.5. Log every call (success or failure) to `llm_call_logs`.

---

## 7. Non-Functional Requirements

- **Security:** passwords bcrypt-hashed, JWT secret and service token must be read from environment variables (never hardcoded, never committed). CORS on api-core restricted to the known frontend origin(s). ai-service's internal endpoints reject any request without a valid `X-Service-Token`.
- **Reliability:** booking-critical writes (hold, confirm, cancel, leave-cascade) must succeed and persist even if ai-service, Gemini, email, or Google Calendar are down or slow — those calls are fire-and-forget or independently retried, never blocking or rolling back the core transaction.
- **Consistency:** the `(doctor_id, slot_start)` uniqueness for non-cancelled appointments is enforced at the database level, not just in application code.
- **Portability:** entire stack must run locally via `docker compose up -d` (Postgres) + three separately-run dev servers, documented with exact commands in the README.
- **No unnecessary dependencies:** do not add packages beyond what's needed for the requirements above (submission guidelines penalize bloat).

---

## 8. Tech Stack Summary (fixed — do not substitute)

| Service | Stack |
|---|---|
| web | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| api-core | ASP.NET Core 8 Web API, EF Core, Npgsql, JWT Bearer auth, BCrypt.Net-Next |
| ai-service | Django + Django REST Framework, `google-genai`, Django's SMTP email backend |
| Database | PostgreSQL, single instance, two schemas (`core`, `notify`) |
| Local dev infra | Docker Compose (Postgres only; each app service run natively via `dotnet run` / `python manage.py runserver` / `npm run dev`) |

---

## 9. Environment Variables (per service, all required, none hardcoded)

**api-core** (`appsettings.json` / environment): `ConnectionStrings:Default`, `Jwt:Secret`, `Jwt:Issuer`, `Jwt:ExpiryMinutes`, `ServiceToken`, Google OAuth client id/secret + stored refresh token.

**ai-service** (`.env`): `DJANGO_SECRET_KEY`, `DEBUG`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `SERVICE_TOKEN` (must match api-core's), `GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`.

**web** (`.env.local`): `NEXT_PUBLIC_API_BASE_URL`.

`SERVICE_TOKEN` in api-core and ai-service must be the identical value — this is the shared secret, not two independent values.

---

## 10. Frontend Requirements (web)

Minimum pages, each calling api-core via the `apiFetch` wrapper (attaches JWT from storage):
- `/register`, `/login`
- `/doctors` (browse/search), `/doctors/[id]` (availability + booking flow: pick slot → hold → symptom form → confirm)
- `/appointments` (patient's own list, cancel action, view post-visit summary when available)
- `/doctor/schedule` (doctor's upcoming appointments)
- `/doctor/appointments/[id]` (view pre-visit summary, submit clinical notes + prescriptions form)
- `/admin/doctors` (list/create/edit doctor profiles)
- `/admin/doctors/[id]/leave` (mark leave dates)

Route guards: redirect unauthenticated users to `/login`; hide/reject role-inappropriate routes client-side (server-side enforcement is what actually matters and already exists in api-core — client-side guarding is just UX).

---

## 11. Deliverables Expected From the Agent

1. Fully working code in `web/`, `api-core/`, `ai-service/` per all sections above.
2. EF Core migrations for `core` schema; Django migrations for `notify` schema.
3. Automated concurrency test for the booking race condition (§5.3).
4. `README.md` at repo root covering: prerequisites, exact setup/run commands for all three services, environment variable reference, how Google Calendar OAuth is configured, API reference (all `/api/*` and `/internal/*` routes), and how to run the two Django management commands.
5. `.gitignore` excluding `node_modules/`, `.next/`, `bin/`, `obj/`, `__pycache__/`, `venv/`, all `.env*` files, and editor/OS files.
6. A `SYSTEM_DESIGN.md` (≤800 words) explaining: double-booking prevention, doctor-leave cascade cancellation, the slot-hold mechanism, notification failure/retry handling, and why the work is split across three services.

---

## 12. Acceptance Criteria (what "done" means)

- A patient can register, browse doctors, book an available slot, and cannot book a slot that is already held or confirmed by someone else (verified by the automated concurrency test).
- A doctor can see the AI-generated pre-visit summary for an upcoming appointment and submit notes that generate an AI post-visit summary visible to the patient.
- Marking a doctor on leave cancels their confirmed appointments for that date and triggers cancellation emails (verifiable via `email_logs` rows even if real SMTP isn't configured in dev — the row and attempted send must occur).
- If the Gemini API key is invalid or the service is unreachable, booking and note-submission still complete successfully with fallback summary content, and the failure is logged in `llm_call_logs`.
- If email sending fails, the booking/cancellation/leave action still succeeds, and the `email_logs` row reflects a `FAILED` status with a scheduled retry.
- The entire system runs locally end-to-end following only the README's documented commands.
