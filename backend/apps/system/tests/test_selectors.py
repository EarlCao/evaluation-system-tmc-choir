import pytest

from apps.system import selectors
from apps.system.models import SystemSettings

pytestmark = pytest.mark.django_db


def test_get_settings_is_cached(django_assert_num_queries):
    first = selectors.get_settings()
    with django_assert_num_queries(0):
        second = selectors.get_settings()
    assert second.pk == first.pk


def test_invalidate_settings_cache_forces_reload(django_assert_max_num_queries):
    selectors.get_settings()
    SystemSettings.objects.filter(pk=1).update(system_name="Changed directly")
    assert selectors.get_settings().system_name != "Changed directly"  # still cached

    selectors.invalidate_settings_cache()
    assert selectors.get_settings().system_name == "Changed directly"


def test_public_settings_expose_only_whitelisted_fields():
    """SET-03: retention policy, thresholds, etc. are not public."""
    public = selectors.get_public_settings()
    assert set(public) == {
        "system_name",
        "choir_name",
        "choir_description",
        "privacy_notice",
        "registration_mode",
        "min_comment_prompts",
    }
