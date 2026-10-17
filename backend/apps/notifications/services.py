"""Public write API of the notifications module."""

from django.utils import timezone

from apps.core.exceptions import ValidationError

from . import selectors
from .constants import LINK_MAX, MESSAGE_MAX, NotificationType
from .models import Notification


def notify(*, recipient, type: str, message: str, link: str = "") -> Notification:
    """Create one notification. Callers (event handlers, step 5.2) pass safe, generic text
    only (RT-06). ``link`` must be a relative path inside the SPA."""
    if type not in NotificationType.values:
        raise ValidationError(fields={"type": ["Unknown notification type."]})
    message = message.strip()
    if not message or len(message) > MESSAGE_MAX:
        raise ValidationError(fields={"message": [f"1 to {MESSAGE_MAX} characters."]})
    if link and (not link.startswith("/") or link.startswith("//") or len(link) > LINK_MAX):
        raise ValidationError(fields={"link": ["Use a relative path inside the app."]})
    return Notification.objects.create(recipient=recipient, type=type, message=message, link=link)


def mark_read(*, user, public_id) -> Notification:
    notification = selectors.get_own(user=user, public_id=public_id)
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
    return notification


def mark_all_read(*, user) -> int:
    return Notification.objects.filter(recipient=user, is_read=False).update(
        is_read=True, read_at=timezone.now()
    )
