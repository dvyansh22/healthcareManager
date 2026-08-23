"""
Django settings for config project.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------- #
# Environment helper — reads from process environment (set via .env + python-dotenv)
# --------------------------------------------------------------------------- #
def env(key, default=None):
    val = os.environ.get(key, default)
    if val is None:
        raise RuntimeError(f"Required environment variable '{key}' is not set.")
    return val


# --------------------------------------------------------------------------- #
# Core settings
# --------------------------------------------------------------------------- #
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DEBUG", "False").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = ["*"]

# --------------------------------------------------------------------------- #
# Service token — must match api-core's ServiceToken config value
# --------------------------------------------------------------------------- #
SERVICE_TOKEN = env("SERVICE_TOKEN")

# --------------------------------------------------------------------------- #
# Gemini (Google AI)
# --------------------------------------------------------------------------- #
GEMINI_API_KEY = env("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-flash-lite-latest"

# --------------------------------------------------------------------------- #
# Installed apps
# --------------------------------------------------------------------------- #
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "notify",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --------------------------------------------------------------------------- #
# Database — shared Postgres, notify schema for writes, core schema read-only
# --------------------------------------------------------------------------- #
import urllib.parse
db_url_str = os.environ.get("DATABASE_URL")

if db_url_str:
    urllib.parse.uses_netloc.append("postgres")
    url = urllib.parse.urlparse(db_url_str)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": url.path[1:],
            "USER": url.username,
            "PASSWORD": url.password,
            "HOST": url.hostname,
            "PORT": url.port or 5432,
            "OPTIONS": {"options": "-c search_path=notify,core"},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME"),
            "USER": env("DB_USER"),
            "PASSWORD": env("DB_PASSWORD"),
            "HOST": env("DB_HOST"),
            "PORT": env("DB_PORT", "5432"),
            "OPTIONS": {"options": "-c search_path=notify,core"},
        }
    }

# --------------------------------------------------------------------------- #
# Email backend
# Use console backend in DEBUG mode so emails work without real SMTP
# --------------------------------------------------------------------------- #
if DEBUG:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("SMTP_HOST")
    EMAIL_PORT = int(env("SMTP_PORT", "587"))
    EMAIL_HOST_USER = env("SMTP_USER")
    EMAIL_HOST_PASSWORD = env("SMTP_PASSWORD")
    EMAIL_USE_TLS = True

DEFAULT_FROM_EMAIL = os.environ.get("SMTP_USER", "noreply@healthcare.local")

# --------------------------------------------------------------------------- #
# Auth password validators
# --------------------------------------------------------------------------- #
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
