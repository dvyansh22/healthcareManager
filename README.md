# Healthcare Appointment & Follow-up Manager

A full-stack polyglot microservice application with three user roles (Patient, Doctor, Admin), AI-generated medical summaries via Google Gemini, automated email notifications, medication reminders, and Google Calendar sync.

---

## Prerequisites

| Tool | Version |
|---|---|
| .NET SDK | 10.0+ |
| Python | 3.11+ |
| Node.js | 18+ (via nvm recommended) |
| Docker + Docker Compose | Any recent version |

---

## 1. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with database `healthcare`, user `healthcare`, password `healthcare`.

---

## 2. api-core (ASP.NET Core 8)

### Setup

```bash
cd api-core/ApiCore
```

Edit `appsettings.json` and fill in real values for:
- `Jwt:Secret` — any 32+ character random string
- `ServiceToken` — a random shared secret (must match `ai-service`'s `SERVICE_TOKEN`)
- `Google:ClientId`, `Google:ClientSecret`, `Google:RefreshToken` — optional, see **Google Calendar** section below

### Apply migrations

```bash
/usr/local/share/dotnet/dotnet run --project . -- --migrate
```

Or apply manually when running for the first time (EF Core runs `Database.Migrate()` on startup if configured — alternatively, connect to Postgres and run the migration SQL from the Migrations/ folder).

The easiest approach is to run the app once; EF Core will apply pending migrations automatically if you add `app.Services.GetRequiredService<AppDbContext>().Database.Migrate()` to `Program.cs`, or use:

```bash
# With dotnet-ef installed:
dotnet ef database update
```

### Run

```bash
/usr/local/share/dotnet/dotnet run
```

API runs on `http://localhost:5000` by default. Swagger UI at `http://localhost:5000/swagger`.

---

## 3. ai-service (Django)

### Setup

```bash
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env` and fill in values:

```bash
cp .env .env.local  # or edit .env directly
```

Required values:
- `DJANGO_SECRET_KEY` — any long random string
- `SERVICE_TOKEN` — **must match** `api-core`'s `ServiceToken` config value
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey) (free, no billing required)
- `SMTP_*` — SMTP credentials; in `DEBUG=True` mode, emails print to console instead

### Apply migrations (notify schema)

```bash
python manage.py migrate
```

This creates the `notify` schema tables (`medication_reminders`, `email_logs`, `llm_call_logs`).

### Create Django superuser (for admin panel)

```bash
python manage.py createsuperuser
```

### Run

```bash
python manage.py runserver 8000
```

Django admin panel at `http://localhost:8000/admin/`.

---

## 4. web (Next.js 14)

### Setup

```bash
cd web
npm install
```

Edit `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

### Run

```bash
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Environment Variable Reference

### api-core (`appsettings.json` / environment)

| Key | Description |
|---|---|
| `ConnectionStrings:Default` | PostgreSQL connection string |
| `Jwt:Secret` | HMAC-SHA256 secret (min 32 chars) |
| `Jwt:Issuer` | Token issuer string |
| `Jwt:ExpiryMinutes` | Token lifetime (default: 120) |
| `ServiceToken` | Shared secret with ai-service |
| `AiService:BaseUrl` | ai-service base URL (default: `http://localhost:8000/`) |
| `Google:ClientId` | Google OAuth2 client ID |
| `Google:ClientSecret` | Google OAuth2 client secret |
| `Google:RefreshToken` | Clinic account refresh token |
| `Frontend:Origin` | Allowed CORS origin |

### ai-service (`.env`)

| Key | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for dev (enables console email backend) |
| `DB_NAME/USER/PASSWORD/HOST/PORT` | PostgreSQL connection |
| `SERVICE_TOKEN` | Must match api-core's `ServiceToken` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `SMTP_HOST/PORT/USER/PASSWORD` | SMTP credentials (only used when `DEBUG=False`) |

### web (`.env.local`)

| Key | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | api-core base URL |

---

## Google Calendar OAuth Setup

The system uses a single **clinic-owned** Google Calendar account:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create a project → Enable **Google Calendar API**.
2. Create OAuth2 credentials (type: Web Application). Add `http://localhost:5000/oauth/callback` as a redirect URI.
3. Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) or a one-time script to exchange an authorization code for a refresh token with scope `https://www.googleapis.com/auth/calendar`.
4. Set `Google:ClientId`, `Google:ClientSecret`, and `Google:RefreshToken` in `api-core`'s `appsettings.json`.

If these values are absent or empty, the `GoogleCalendarService` gracefully degrades: calendar events are not created/deleted, and `null` is stored for event IDs. All booking operations still succeed.

---

## API Reference

### Public

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Patient self-registration |
| POST | `/api/auth/login` | Login (any role), returns JWT |
| GET | `/api/doctors` | List doctors (optional `?specialization=`) |
| GET | `/api/doctors/:id/availability` | Free slots (`?date=YYYY-MM-DD`) |

### Patient (JWT required, role=Patient)

| Method | Path | Description |
|---|---|---|
| POST | `/api/appointments/hold` | Hold a slot (10-min hold) |
| POST | `/api/appointments/confirm` | Confirm a hold |
| GET | `/api/appointments/mine` | List own appointments |
| POST | `/api/appointments/:id/cancel` | Cancel an appointment |

### Doctor (JWT required, role=Doctor)

| Method | Path | Description |
|---|---|---|
| GET | `/api/appointments/mine` | List own appointments (with pre-visit summary) |
| POST | `/api/appointments/:id/cancel` | Cancel an appointment |
| POST | `/api/appointments/:id/notes` | Submit clinical notes + prescriptions |

### Admin (JWT required, role=Admin)

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/users` | Create Doctor/Admin account |
| GET | `/api/admin/doctors` | List all doctor profiles |
| POST | `/api/admin/doctors/:userId` | Create/update DoctorProfile |
| PUT | `/api/admin/doctors/:profileId` | Update DoctorProfile |
| POST | `/api/admin/doctors/:profileId/leave` | Mark leave, cascade-cancel appointments |

### ai-service Internal (header `X-Service-Token` required)

| Method | Path | Description |
|---|---|---|
| POST | `/internal/llm/pre-visit` | Generate pre-visit AI summary |
| POST | `/internal/llm/post-visit` | Generate post-visit AI summary |
| POST | `/internal/notify/booking-confirmed` | Send booking confirmation email |
| POST | `/internal/notify/cancellation` | Send cancellation email |
| POST | `/internal/notify/leave-cancellation` | Send leave cancellation emails (batch) |
| POST | `/internal/notify/booking-completed` | Schedule medication reminders |

---

## Django Management Commands

Run these manually or via an external cron (every 5 minutes recommended):

```bash
# Send due medication reminders
python manage.py send_due_reminders

# Retry failed emails per backoff schedule
python manage.py retry_failed_emails
```

---

## Running the Concurrency Test

```bash
cd api-core/ApiCore.Tests
/usr/local/share/dotnet/dotnet test
```

This runs the `ConcurrencyTests` which fires 10 concurrent confirm requests at the same slot and asserts exactly 1 succeeds and 9 return 409.

---

## Full Local Stack

```bash
# Terminal 1: Database
docker compose up -d

# Terminal 2: api-core
cd api-core/ApiCore && /usr/local/share/dotnet/dotnet run

# Terminal 3: ai-service
cd ai-service && source venv/bin/activate && python manage.py runserver 8000

# Terminal 4: web
cd web && npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Production Deployment Guide

Deploying this polyglot stack is straightforward. We recommend using a managed PostgreSQL database (e.g., Neon, Supabase, Render Postgres) and standard PaaS providers.

### 1. Database (Render / Neon / Railway)
- Provision a managed PostgreSQL 15+ database.
- Note the public `Connection String` (e.g. `postgres://user:pass@host:5432/db`).

### 2. api-core (Render Web Service)
- **Environment:** Docker
- **Build Command:** (Use a standard ASP.NET Core Dockerfile pointing to `api-core/ApiCore/ApiCore.csproj`)
- **Start Command:** `dotnet ApiCore.dll`
- **Env Vars:** 
  - `ConnectionStrings__Default` = `<Your DB Connection String>`
  - `Jwt__Secret` = `<Random 32+ char string>`
  - `ServiceToken` = `<Random secret>`
  - `Frontend__Origin` = `https://your-frontend-url.vercel.app`

### 3. ai-service (Render Web Service)
- **Environment:** Python 3
- **Root Directory:** `ai-service`
- **Build Command:** `pip install -r requirements.txt && python manage.py migrate`
- **Start Command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- **Env Vars:**
  - `DATABASE_URL` = `<Your DB Connection String>` (or configure via DB_NAME, DB_USER, etc.)
  - `DJANGO_SECRET_KEY` = `<Random secret>`
  - `SERVICE_TOKEN` = `<Must match api-core>`
  - `GEMINI_API_KEY` = `<Your Gemini Key>`

### 4. web (Vercel)
- **Environment:** Next.js
- **Root Directory:** `web`
- **Build Command:** `npm run build`
- **Env Vars:**
  - `NEXT_PUBLIC_API_BASE_URL` = `https://your-api-core-url.onrender.com`

*See `.env.example` in the root folder for a comprehensive list of all required variables across the stack.*
