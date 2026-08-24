import json
import logging
from datetime import timezone, datetime

from django.conf import settings

from notify.models import LlmCallLog

logger = logging.getLogger(__name__)

GEMINI_TIMEOUT = 20  # seconds


def _get_client():
    """Return a configured Gemini client or raise ImportError / RuntimeError."""
    from google import genai  # type: ignore
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def call_pre_visit(appointment_id: str, symptom_text: str) -> dict:
    """
    Calls Gemini to produce a pre-visit summary.
    Always returns a usable dict (fallback on any error).
    Logs every call (success or failure) to llm_call_logs.
    """
    fallback = {
        "urgency": "Unknown",
        "chief_complaint": symptom_text[:150] if symptom_text else "",
        "questions": [],
    }

    prompt = (
        "Respond ONLY with valid JSON, no markdown. Use keys: \"urgency\", \"chief_complaint\", and \"questions\" (array).\n"
        f"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptom_text}"
    )

    log = LlmCallLog(
        appointment_id=appointment_id,
        call_type="PRE_VISIT",
        status="PENDING",
    )
    log.save()

    try:
        import signal

        def _timeout(signum, frame):
            raise TimeoutError("Gemini call timed out")

        signal.signal(signal.SIGALRM, _timeout)
        signal.alarm(GEMINI_TIMEOUT)

        client = _get_client()
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        signal.alarm(0)

        result = json.loads(response.text)
        log.status = "SUCCESS"
        log.raw_response = response.text
        log.save()
        return result

    except Exception as exc:
        log.status = "FAILED"
        log.error = str(exc)
        log.save()
        logger.warning("pre-visit LLM call failed for appointment %s: %s", appointment_id, exc)
        return fallback


def call_post_visit(appointment_id: str, clinical_notes: str) -> dict:
    """
    Calls Gemini to produce a post-visit patient-friendly summary.
    Always returns a usable dict (fallback on any error).
    """
    fallback = {
        "summary_text": clinical_notes or "",
        "medication_schedule": [],
        "follow_up_steps": [],
    }

    prompt = (
        "Respond ONLY with valid JSON, no markdown. Use keys: \"summary_text\", \"medication_schedule\" (array of {name, dosage, frequency, duration}), and \"follow_up_steps\" (array).\n"
        f"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: {clinical_notes}"
    )

    log = LlmCallLog(
        appointment_id=appointment_id,
        call_type="POST_VISIT",
        status="PENDING",
    )
    log.save()

    try:
        import signal

        def _timeout(signum, frame):
            raise TimeoutError("Gemini call timed out")

        signal.signal(signal.SIGALRM, _timeout)
        signal.alarm(GEMINI_TIMEOUT)

        client = _get_client()
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        signal.alarm(0)

        result = json.loads(response.text)
        log.status = "SUCCESS"
        log.raw_response = response.text
        log.save()
        return result

    except Exception as exc:
        log.status = "FAILED"
        log.error = str(exc)
        log.save()
        logger.warning("post-visit LLM call failed for appointment %s: %s", appointment_id, exc)
        return fallback
