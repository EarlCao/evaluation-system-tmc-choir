"""Production settings. Hardened further in roadmap step 6.3 (`check --deploy` must be clean)."""

from .base import *

DEBUG = False

USE_X_FORWARDED_FOR = env.bool("USE_X_FORWARDED_FOR", default=True)
REST_FRAMEWORK["NUM_PROXIES"] = 1 if USE_X_FORWARDED_FOR else 0
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
