from django.apps import AppConfig


class SystemConfig(AppConfig):
    """System-wide settings, privacy notice and retention policy (SET-01..06)."""

    name = "apps.system"
    label = "system"
    verbose_name = "System settings"
