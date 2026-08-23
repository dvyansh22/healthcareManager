#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path

# Load .env before Django reads settings
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass  # python-dotenv not installed; rely on OS environment



def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
        
    # FIX: Render fresh database schema issue
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        try:
            import psycopg2
            from urllib.parse import urlparse
            db_url = os.environ.get("DATABASE_URL")
            if db_url:
                url = urlparse(db_url)
                conn = psycopg2.connect(
                    dbname=url.path[1:], user=url.username,
                    password=url.password, host=url.hostname, port=url.port or 5432
                )
                conn.autocommit = True
                with conn.cursor() as cur:
                    cur.execute("CREATE SCHEMA IF NOT EXISTS notify;")
                conn.close()
            else:
                conn = psycopg2.connect(
                    dbname=os.environ.get("DB_NAME"), user=os.environ.get("DB_USER"),
                    password=os.environ.get("DB_PASSWORD"), host=os.environ.get("DB_HOST"), port=os.environ.get("DB_PORT", 5432)
                )
                conn.autocommit = True
                with conn.cursor() as cur:
                    cur.execute("CREATE SCHEMA IF NOT EXISTS notify;")
                conn.close()
        except Exception as e:
            print(f"Warning: Failed to ensure 'notify' schema exists: {e}")

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
