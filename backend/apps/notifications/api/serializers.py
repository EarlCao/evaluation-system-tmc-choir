from rest_framework import serializers

from ..models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["public_id", "type", "message", "link", "is_read", "read_at", "created_at"]


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField()


class MarkedSerializer(serializers.Serializer):
    marked = serializers.IntegerField()
