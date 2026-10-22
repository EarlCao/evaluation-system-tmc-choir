"""Production settings (step 6.3, Security Model, NFR-03).

``python manage.py check --deploy --settings=config.settings.prod`` must pass with zero issues.
"""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

_render_hostname = env("RENDER_EXTERNAL_HOSTNAME", default="").strip()
if _render_hostname and _render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_hostname]

if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "Production requires explicit DJANGO_ALLOWED_HOSTS (wildcard '*' is not allowed)."
    )

for _key_name, _key_val in (
    ("DJANGO_SECRET_KEY", SECRET_KEY),
    ("FEEDBACK_ID_KEY", FEEDBACK_ID_KEY),
):
    if (
        len(_key_val) < (50 if _key_name == "DJANGO_SECRET_KEY" else 32)
        or "change-me" in _key_val.lower()
        or _key_val.startswith("django-insecure")
    ):
        raise ImproperlyConfigured(
            f"{_key_name} must be a strong, unique secret "
            "(DJANGO_SECRET_KEY: at least 50 characters; FEEDBACK_ID_KEY: at least 32)."
        )

if SECRET_KEY == FEEDBACK_ID_KEY:
    raise ImproperlyConfigured("FEEDBACK_ID_KEY must differ from DJANGO_SECRET_KEY.")

if CACHES["default"]["BACKEND"] != "django.core.cache.backends.redis.RedisCache":
    raise ImproperlyConfigured(
        "Production requires REDIS_URL for shared OTPs, throttles and realtime."
    )

if EMAIL_BACKEND == "apps.core.email_backend.GmailEmailBackend":
    if not all((GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)) or (
        DEFAULT_FROM_EMAIL == "no-reply@example.org"
    ):
        raise ImproperlyConfigured(
            "Gmail requires OAuth client ID, client secret, refresh token and DEFAULT_FROM_EMAIL."
        )
elif EMAIL_BACKEND == "apps.core.email_backend.BrevoEmailBackend":
    if not BREVO_API_KEY or DEFAULT_FROM_EMAIL == "no-reply@example.org":
        raise ImproperlyConfigured(
            "Brevo requires BREVO_API_KEY and a verified DEFAULT_FROM_EMAIL."
        )
elif EMAIL_BACKEND != "django.core.mail.backends.smtp.EmailBackend" or not EMAIL_HOST:
    raise ImproperlyConfigured(
        "Production requires SMTP, Gmail HTTPS or Brevo HTTPS email delivery."
    )

if urlsplit(FRONTEND_URL).scheme != "https":
    raise ImproperlyConfigured("Production requires an HTTPS FRONTEND_URL.")

USE_X_FORWARDED_FOR = env.bool("USE_X_FORWARDED_FOR", default=True)
REST_FRAMEWORK["NUM_PROXIES"] = 1 if USE_X_FORWARDED_FOR else 0
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=True)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE", default="Lax")
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=60 * 60 * 12)
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = env("CSRF_COOKIE_SAMESITE", default="Lax")

CONTENT_SECURITY_POLICY = env(
    "CONTENT_SECURITY_POLICY",
    default=(
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self' wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
)
