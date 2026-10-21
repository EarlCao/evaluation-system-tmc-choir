# syntax=docker/dockerfile:1
# Production image for the Django + Channels backend (served by Daphne over ASGI, step 6.3).
FROM python:3.12.15-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc pkg-config default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements/ /tmp/requirements/
RUN pip wheel --wheel-dir=/wheels -r /tmp/requirements/prod.txt


FROM python:3.12.15-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

RUN apt-get update \
    && apt-get install -y --no-install-recommends libmariadb3 default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* \
    && rm -rf /wheels

RUN groupadd --gid 1000 app && useradd --uid 1000 --gid 1000 --create-home app \
    && mkdir -p /app/backups && chown app:app /app/backups

WORKDIR /app/backend
COPY --chown=app:app backend/ /app/backend/

# Collect static files using temporary build-time placeholders (real secrets injected at runtime).
RUN DJANGO_SECRET_KEY="build-only-placeholder-key-at-least-thirty-two-chars-1" \
    FEEDBACK_ID_KEY="build-only-placeholder-key-at-least-thirty-two-chars-2" \
    DJANGO_ALLOWED_HOSTS="localhost" \
    FRONTEND_URL="https://localhost" \
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend" \
    DATABASE_URL="sqlite:///:memory:" \
    python manage.py collectstatic --noinput

USER app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import os, urllib.request; host = os.environ['DJANGO_ALLOWED_HOSTS'].split(',')[0].strip().lstrip('.'); req = urllib.request.Request('http://127.0.0.1:8000/api/v1/health/', headers={'X-Forwarded-Proto': 'https', 'Host': host}); urllib.request.urlopen(req, timeout=3)"

CMD ["sh", "-c", "python manage.py migrate --noinput && exec daphne -b 0.0.0.0 -p 8000 config.asgi:application"]
