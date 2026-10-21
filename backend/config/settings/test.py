"""Test settings (pytest). Uses the MySQL server from docker compose (ADR-011)."""

import os

# Secrets are not needed for tests; .env (if present) still supplies DATABASE_URL.
os.environ.setdefault("DJANGO_SECRET_KEY", "test-insecure-secret-key")
os.environ.setdefault("FEEDBACK_ID_KEY", "test-insecure-feedback-key")

from .base import *

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # speed only
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Concrete models used to test core's abstract base models.
INSTALLED_APPS = [*INSTALLED_APPS, "apps.core.tests.testapp"]

LOGGING["root"]["level"] = "WARNING"

# No Redis needed for tests; consumers are tested with the in-memory layer.
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
