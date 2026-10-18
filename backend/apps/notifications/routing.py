"""WebSocket routes of the notifications module (Realtime Architecture)."""

from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/notifications/", consumers.NotificationConsumer.as_asgi()),
    path("ws/admin/", consumers.AdminConsumer.as_asgi()),
]
