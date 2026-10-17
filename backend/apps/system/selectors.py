"""Public read API of the system module."""

from django.core.cache import cache

from .constants import SETTINGS_CACHE_KEY, SETTINGS_CACHE_TIMEOUT_SECONDS
from .models import SystemSettings

PUBLIC_FIELDS = (
    "system_name",
    "choir_name",
    "choir_description",
    "privacy_notice",
    "registration_mode",
)


def get_settings() -> SystemSettings:
    """Current settings, cached. Treat the result as read-only; change settings only via
    ``system.services.update_settings``.

    Note: until Redis caching arrives (step 5.1) the cache is per-process, so other worker
    processes may serve values up to ``SETTINGS_CACHE_TIMEOUT_SECONDS`` old.
    """
    settings_obj = cache.get(SETTINGS_CACHE_KEY)
    if settings_obj is None:
        settings_obj = SystemSettings.load()
        cache.set(SETTINGS_CACHE_KEY, settings_obj, SETTINGS_CACHE_TIMEOUT_SECONDS)
    return settings_obj


def get_public_settings() -> dict:
    """Settings that anyone may see (welcome page, register form, privacy notice)."""
    settings_obj = get_settings()
    return {field: getattr(settings_obj, field) for field in PUBLIC_FIELDS}


def invalidate_settings_cache() -> None:
    cache.delete(SETTINGS_CACHE_KEY)
