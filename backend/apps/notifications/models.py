from django.conf import settings
from django.db import models

from apps.core.models import PublicIdModel

from .constants import LINK_MAX, MESSAGE_MAX, NotificationType


class Notification(PublicIdModel):
    """One in-app notification. ``message`` is safe, generic text (RT-06): never an
    evaluator's name, id or exact submission time. ``link`` is a relative SPA path."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=NotificationType.choices)
    message = models.CharField(max_length=MESSAGE_MAX)
    link = models.CharField(max_length=LINK_MAX, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "-created_at"], name="notif_recipient_unread_idx"
            )
        ]

    def __str__(self) -> str:
        return f"{self.type} → {self.recipient_id}"
