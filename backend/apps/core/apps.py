from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Shared kernel: no business logic, depends on no other project module."""

    name = "apps.core"
    label = "core"
    verbose_name = "Core"

    def ready(self) -> None:
        from . import schema  # noqa: F401  (registers OpenAPI extensions)
