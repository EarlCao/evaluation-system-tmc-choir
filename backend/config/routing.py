"""WebSocket URL routes. Each module that serves WebSockets contributes its patterns."""

from apps.notifications.routing import websocket_urlpatterns as notification_patterns

websocket_urlpatterns = [*notification_patterns]
