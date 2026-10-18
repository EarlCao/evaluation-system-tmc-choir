"""Pushing to WebSocket groups (Realtime Architecture). Best effort: the REST API is the source
of truth, so a push that fails (e.g. Redis down) is logged and never breaks the request.

Payloads are safe by construction: a serialized notification of the user's own, an unread
count, or a bare "something changed" hint for admins. Never evaluator details (RT-06).
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

ADMINS_GROUP = "admins"
DASHBOARD_THROTTLE_SECONDS = 5


def user_group(public_id) -> str:
    return f"user.{public_id}"


def _send(group: str, message_type: str, payload: dict | None = None) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            group,
            {
                "type": message_type.replace(".", "_"),  # consumer handler name
                "event": message_type,
                "payload": payload or {},
                "sent_at": timezone.now().isoformat(),
            },
        )
    except Exception:
        logger.warning("WebSocket push to %s failed", group, exc_info=True)


def push_after_commit(group: str, message_type: str, payload: dict | None = None) -> None:
    transaction.on_commit(lambda: _send(group, message_type, payload))


def dashboard_changed() -> None:
    """Tell connected Super Admins to refetch dashboard counts (at most once per 5 s)."""
    if cache.add("notifications:dashboard-changed", 1, DASHBOARD_THROTTLE_SECONDS):
        push_after_commit(ADMINS_GROUP, "dashboard.changed")
