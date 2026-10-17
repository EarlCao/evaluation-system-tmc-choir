"""Public read API of the notifications module."""

from uuid import UUID

from django.db.models import QuerySet

from apps.core.exceptions import NotFound

from .models import Notification


def list_for(*, user, unread_only: bool = False) -> QuerySet[Notification]:
    """The user's own notifications, newest first. Never anybody else's."""
    qs = Notification.objects.filter(recipient=user)
    return qs.filter(is_read=False) if unread_only else qs


def unread_count(*, user) -> int:
    return Notification.objects.filter(recipient=user, is_read=False).count()


def get_own(*, user, public_id: UUID | str) -> Notification:
    notification = Notification.objects.filter(recipient=user, public_id=public_id).first()
    if notification is None:
        raise NotFound()
    return notification
