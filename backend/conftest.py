"""Project-wide pytest fixtures. Module-specific factories live in apps/<module>/tests/."""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _clear_cache():
    """Each test starts with an empty cache (settings and throttle counters are cached)."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def csrf_api_client() -> APIClient:
    """Client that enforces CSRF like a real browser session does."""
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def member(db):
    """An ACTIVE choir member with a profile."""
    from apps.members.tests.factories import MemberProfileFactory

    return MemberProfileFactory().user


@pytest.fixture
def super_admin(db):
    from apps.accounts.tests.factories import SuperAdminFactory

    return SuperAdminFactory()


@pytest.fixture
def actor(super_admin):
    """The user performing an admin operation."""
    return super_admin


@pytest.fixture
def member_client(member) -> APIClient:
    client = APIClient()
    client.force_login(member)
    return client


@pytest.fixture
def admin_client_api(super_admin) -> APIClient:
    client = APIClient()
    client.force_login(super_admin)
    return client


@pytest.fixture
def registration_mode(db):
    """Set the registration mode for a test: ``registration_mode("OPEN")``."""
    from apps.system.models import SystemSettings
    from apps.system.selectors import invalidate_settings_cache

    def set_mode(mode: str) -> None:
        SystemSettings.objects.filter(pk=1).update(registration_mode=mode)
        invalidate_settings_cache()

    return set_mode
