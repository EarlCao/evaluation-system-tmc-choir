from django.apps import AppConfig


class AuditConfig(AppConfig):
    """Append-only audit log (AUD-01..05). Consumes every audited domain event."""

    name = "apps.audit"
    label = "audit"
    verbose_name = "Audit log"

    def ready(self) -> None:
        from . import handlers  # noqa: F401  (registers event subscribers)
