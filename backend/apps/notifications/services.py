"""Public write API of the notifications module."""

from datetime import datetime, timedelta

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.accounts import selectors as account_selectors
from apps.accounts.constants import UserRole
from apps.core.exceptions import ValidationError
from apps.system.selectors import get_settings

from . import realtime, selectors
from .constants import LINK_MAX, MESSAGE_MAX, NotificationType
from .models import Notification, PendingFeedbackNotice

FEEDBACK_MESSAGE = "You have new feedback."
FEEDBACK_LINK = "/app/feedback"


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
    notification = Notification.objects.create(
        recipient=recipient, type=type, message=message, link=link
    )
    _push(notification)
    return notification


def _serialize(n: Notification) -> dict:
    return {
        "public_id": str(n.public_id),
        "type": n.type,
        "message": n.message,
        "link": n.link,
        "is_read": n.is_read,
        "read_at": None,
        "created_at": n.created_at.isoformat(),
    }


def _push(notification: Notification) -> None:
    recipient = notification.recipient
    realtime.push_after_commit(
        realtime.user_group(recipient.public_id),
        "notification.created",
        {
            "notification": _serialize(notification),
            "unread": selectors.unread_count(user=recipient),
        },
    )


def notify_many(*, recipient_ids, type: str, message: str, link: str = "") -> int:
    """Fan-out to many users (cycle opened/closed, admin notices)."""
    created = 0
    for user_id in recipient_ids:
        user = account_selectors.get_active_user(pk=user_id)
        if user is not None:
            notify(recipient=user, type=type, message=message, link=link)
            created += 1
    return created


# Feedback notices (RT-02): debounced and anonymous ------------------------------------------
def queue_feedback_notice(*, recipient_id: int, cycle_id: int, after_close: bool) -> None:
    """Never notify at the moment of a submission: the time could identify the evaluator.
    Submissions inside one window share a single notice; AFTER_CLOSE cycles wait for close."""
    if after_close:
        if not PendingFeedbackNotice.objects.filter(
            recipient_id=recipient_id, held_for_cycle_id=cycle_id, deliver_after__isnull=True
        ).exists():
            PendingFeedbackNotice.objects.create(
                recipient_id=recipient_id, held_for_cycle_id=cycle_id
            )
        return
    if PendingFeedbackNotice.objects.filter(
        recipient_id=recipient_id, deliver_after__isnull=False
    ).exists():
        return  # already waiting: this submission joins that window
    minutes = get_settings().feedback_notification_debounce_minutes
    PendingFeedbackNotice.objects.create(
        recipient_id=recipient_id, deliver_after=timezone.now() + timedelta(minutes=minutes)
    )
    if minutes == 0:
        transaction.on_commit(lambda: deliver_due(recipient_id=recipient_id))


def release_cycle(*, cycle_id: int) -> int:
    """An AFTER_CLOSE cycle closed: its held notices become due now."""
    return PendingFeedbackNotice.objects.filter(
        held_for_cycle_id=cycle_id, deliver_after__isnull=True
    ).update(deliver_after=timezone.now())


def deliver_due(*, now: datetime | None = None, recipient_id: int | None = None) -> int:
    """Turn due notices into notifications (one per member, and none while an earlier
    feedback notification is still unread). Run by ``manage.py deliver_notifications`` and
    lazily when a member reads their notifications."""
    now = now or timezone.now()
    due = PendingFeedbackNotice.objects.filter(deliver_after__lte=now)
    if recipient_id is not None:
        due = due.filter(recipient_id=recipient_id)
    delivered = 0
    for user_id in set(due.values_list("recipient_id", flat=True)):
        with transaction.atomic():
            rows = PendingFeedbackNotice.objects.select_for_update().filter(
                recipient_id=user_id, deliver_after__lte=now
            )
            if not list(rows):
                continue  # another worker took them
            rows.delete()
            user = account_selectors.get_active_user(pk=user_id)
            if user is None:
                continue
            already = Notification.objects.filter(
                recipient=user, type=NotificationType.FEEDBACK_AVAILABLE, is_read=False
            ).exists()
            if not already:
                notify(
                    recipient=user,
                    type=NotificationType.FEEDBACK_AVAILABLE,
                    message=FEEDBACK_MESSAGE,
                    link=FEEDBACK_LINK,
                )
                delivered += 1
    return delivered


# Security notices (RT-04) ---------------------------------------------------------------------
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60
FAILED_LOGIN_THRESHOLD = 10


def record_failed_login(*, identifier_hash: str) -> bool:
    """Count failures per (hashed) identifier; tell Super Admins once per window when the
    count reaches the threshold. Returns True when an alert was sent."""
    key = f"notifications:failed-login:{identifier_hash}"
    cache.add(key, 0, FAILED_LOGIN_WINDOW_SECONDS)
    try:
        count = cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.set(key, 1, FAILED_LOGIN_WINDOW_SECONDS)
        count = 1
    if count != FAILED_LOGIN_THRESHOLD:
        return False
    notify_many(
        recipient_ids=account_selectors.active_user_ids(role=UserRole.SUPER_ADMIN),
        type=NotificationType.UNUSUAL_ACTIVITY,
        message=(
            f"Unusual sign-in activity: {FAILED_LOGIN_THRESHOLD} failed logins for one account "
            "in 15 minutes. See the audit log."
        ),
        link="/admin/audit?event_type=accounts.user.login_failed",
    )
    return True


def revoke_realtime(*, user) -> None:
    """Close the user's open WebSockets (account suspended or deactivated)."""
    realtime.push_after_commit(realtime.user_group(user.public_id), "session.revoked")


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
