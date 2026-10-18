"""Step 5.2: WebSocket consumers through the real ASGI stack (RT-01, RT-06, Security Model).

Transactional DB: the consumers read the database from another thread.
"""

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.test import Client

from apps.accounts import services as account_services
from apps.notifications import services
from apps.notifications.constants import NotificationType
from apps.notifications.realtime import dashboard_changed
from config.asgi import application

# serialized_rollback: restore the data seeded by migrations (voice sections, settings).
pytestmark = pytest.mark.django_db(transaction=True, serialized_rollback=True)

ORIGIN = (b"origin", b"http://localhost:5280")


def _cookie(user) -> tuple[bytes, bytes]:
    client = Client()
    client.force_login(user)
    session = client.cookies["sessionid"].value
    return (b"cookie", f"sessionid={session}".encode())


def _communicator(path, cookie=None, origin=ORIGIN):
    headers = [origin] + ([cookie] if cookie else [])
    return WebsocketCommunicator(application, path, headers=headers)


def run(coro_fn):
    return async_to_sync(coro_fn)()


def test_anonymous_is_closed():
    async def scenario():
        ws = _communicator("/ws/notifications/")
        connected, code = await ws.connect()
        assert (connected, code) == (False, 4401)

    run(scenario)


def test_foreign_origin_is_rejected(member):
    """Cross-site WebSocket hijacking: a valid session cookie from a foreign page is refused."""
    cookie = _cookie(member)

    async def scenario():
        ws = _communicator(
            "/ws/notifications/", cookie, origin=(b"origin", b"https://evil.example")
        )
        connected, _ = await ws.connect()
        assert connected is False

    run(scenario)


def test_member_receives_own_notifications_live(member):
    cookie = _cookie(member)

    async def scenario():
        ws = _communicator("/ws/notifications/", cookie)
        connected, _ = await ws.connect()
        assert connected
        assert await ws.receive_json_from() == {"type": "unread_count", "payload": {"unread": 0}}

        await database_sync_to_async(services.notify)(
            recipient=member,
            type=NotificationType.CYCLE_OPENED,
            message="Evaluation period “Spring” is open.",
            link="/app/members",
        )
        message = await ws.receive_json_from(timeout=3)
        assert message["type"] == "notification.created"
        assert message["payload"]["unread"] == 1
        assert message["payload"]["notification"]["message"].startswith("Evaluation period")
        await ws.send_json_to({"type": "ping"})
        assert await ws.receive_json_from() == {"type": "pong"}
        await ws.disconnect()

    run(scenario)


def test_admin_socket_is_super_admin_only(member, super_admin):
    member_cookie, admin_cookie = _cookie(member), _cookie(super_admin)

    async def scenario():
        ws = _communicator("/ws/admin/", member_cookie)
        assert await ws.connect() == (False, 4403)

        admin = _communicator("/ws/admin/", admin_cookie)
        connected, _ = await admin.connect()
        assert connected
        await database_sync_to_async(dashboard_changed)()
        message = await admin.receive_json_from(timeout=3)
        assert message["type"] == "dashboard.changed"
        assert message["payload"] == {}  # a hint only: the page refetches over REST
        await admin.disconnect()

    run(scenario)


def test_suspended_member_is_disconnected(member, super_admin):
    cookie = _cookie(member)

    async def scenario():
        ws = _communicator("/ws/notifications/", cookie)
        connected, _ = await ws.connect()
        assert connected
        await ws.receive_json_from()  # unread count
        await database_sync_to_async(account_services.set_user_status)(
            actor=super_admin, user=member, status="SUSPENDED"
        )
        output = await ws.receive_output(timeout=3)
        assert output == {"type": "websocket.close", "code": 4001}

    run(scenario)
