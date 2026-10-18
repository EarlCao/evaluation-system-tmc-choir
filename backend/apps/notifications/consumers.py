"""WebSocket consumers (Realtime Architecture). Authenticated by the session cookie
(AuthMiddlewareStack) and origin-checked in config/asgi.py.

Close codes: 4401 not signed in / not active, 4403 not a Super Admin (admin socket),
4001 session revoked (account suspended or deactivated while connected).
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import selectors
from .realtime import ADMINS_GROUP, user_group

NOT_SIGNED_IN = 4401
NOT_ALLOWED = 4403
REVOKED = 4001


def _is_active(user) -> bool:
    return bool(getattr(user, "is_authenticated", False)) and bool(
        getattr(user, "is_active_member", False)
    )


class _Base(AsyncJsonWebsocketConsumer):
    groups_joined: tuple[str, ...] = ()

    async def disconnect(self, code):
        for group in self.groups_joined:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Clients only listen; a ping keeps proxies from closing idle sockets.
        if isinstance(content, dict) and content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def _forward(self, message: dict) -> None:
        await self.send_json(
            {"type": message["event"], "payload": message["payload"], "sent_at": message["sent_at"]}
        )

    async def session_revoked(self, message: dict) -> None:
        await self.close(code=REVOKED)


class NotificationConsumer(_Base):
    """/ws/notifications/: the signed-in user's own notifications and unread count."""

    async def connect(self):
        user = self.scope.get("user")
        if not _is_active(user):
            await self.close(code=NOT_SIGNED_IN)
            return
        self.groups_joined = (user_group(user.public_id),)
        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()
        unread = await database_sync_to_async(selectors.unread_count)(user=user)
        await self.send_json({"type": "unread_count", "payload": {"unread": unread}})

    async def notification_created(self, message: dict) -> None:
        await self._forward(message)


class AdminConsumer(_Base):
    """/ws/admin/: Super Admins only; "dashboard.changed" hints (no data in the message)."""

    async def connect(self):
        user = self.scope.get("user")
        if not _is_active(user):
            await self.close(code=NOT_SIGNED_IN)
            return
        if not getattr(user, "is_super_admin", False):
            await self.close(code=NOT_ALLOWED)
            return
        self.groups_joined = (ADMINS_GROUP, user_group(user.public_id))
        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()

    async def dashboard_changed(self, message: dict) -> None:
        await self._forward(message)

    async def notification_created(self, message: dict) -> None:
        pass  # delivered on /ws/notifications/
