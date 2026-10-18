"""The signed-in user's own notifications (RT-01..03, RT-05: REST is the polling fallback)."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsActiveMember

from .. import selectors, services
from .serializers import MarkedSerializer, NotificationSerializer, UnreadCountSerializer


class NotificationListView(ListAPIView):
    permission_classes = [IsActiveMember]
    serializer_class = NotificationSerializer

    @extend_schema(parameters=[OpenApiParameter("unread", bool)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        services.deliver_due(recipient_id=self.request.user.pk)  # lazy delivery (no worker needed)
        unread = self.request.query_params.get("unread") == "true"
        return selectors.list_for(user=self.request.user, unread_only=unread)


class UnreadCountView(APIView):
    permission_classes = [IsActiveMember]

    @extend_schema(responses=UnreadCountSerializer)
    def get(self, request):
        services.deliver_due(recipient_id=request.user.pk)
        return Response({"unread": selectors.unread_count(user=request.user)})


class MarkReadView(APIView):
    permission_classes = [IsActiveMember]

    @extend_schema(request=None, responses=NotificationSerializer)
    def post(self, request, public_id):
        notification = services.mark_read(user=request.user, public_id=public_id)
        return Response(NotificationSerializer(notification).data)


class MarkAllReadView(APIView):
    permission_classes = [IsActiveMember]

    @extend_schema(request=None, responses=MarkedSerializer)
    def post(self, request):
        return Response({"marked": services.mark_all_read(user=request.user)})
