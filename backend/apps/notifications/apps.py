from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """In-app notifications + WebSocket delivery (RT-01..06). An event consumer: no other
    module imports it (Module Boundaries)."""

    name = "apps.notifications"
    label = "notifications"
    verbose_name = "Notifications"
