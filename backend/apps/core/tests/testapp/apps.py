from django.apps import AppConfig


class CoreTestAppConfig(AppConfig):
    """Test-only app (installed by config.settings.test) with concrete models for testing
    core's abstract base models. It has no migrations; the test runner syncs it."""

    name = "apps.core.tests.testapp"
    label = "core_testapp"
