from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone

from apps.core.models import AppendOnlyModel


class AuditLog(AppendOnlyModel):
    """Security event with guarded ORM writes; privileged deletion only via ADR-022's
    explicit service exception. Super Admin only. Write via ``audit.services.record``."""

    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    actor_role = models.CharField(max_length=32, blank=True)
    event_type = models.CharField(max_length=100, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    before = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    after = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    request_id = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["target_type", "target_id"], name="audit_target_idx"),
            models.Index(fields=["actor", "-occurred_at"], name="audit_actor_time_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.occurred_at:%Y-%m-%d %H:%M:%S} {self.event_type}"
