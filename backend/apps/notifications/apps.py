from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """In-app notifications + WebSocket delivery (RT-01..06). An event consumer: no other
    module imports it (Module Boundaries)."""

    name = "apps.notifications"
    label = "notifications"
    verbose_name = "Notifications"

    def ready(self) -> None:
        from . import handlers  # noqa: F401  (registers event subscribers)
