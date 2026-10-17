from rest_framework import serializers

from ..models import AuditLog


class AuditActorSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField(source="get_full_name")
    username = serializers.CharField()


class AuditLogSerializer(serializers.ModelSerializer):
    actor = AuditActorSerializer(allow_null=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "occurred_at",
            "event_type",
            "actor",
            "actor_role",
            "target_type",
            "target_id",
            "before",
            "after",
            "metadata",
            "ip_address",
            "user_agent",
            "request_id",
        ]


class AuditFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, default="", max_length=100)
    event_type = serializers.CharField(required=False, default="", max_length=100)
    actor = serializers.UUIDField(required=False)
    target_type = serializers.CharField(required=False, default="", max_length=64)
    target_id = serializers.CharField(required=False, default="", max_length=64)
    occurred_from = serializers.DateField(required=False)
    occurred_to = serializers.DateField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("occurred_from"), attrs.get("occurred_to")
        if start and end and start > end:
            raise serializers.ValidationError({"occurred_to": ["Must be on or after the start."]})
        if "actor" in attrs:
            attrs["actor"] = str(attrs["actor"])
        return attrs


class AuditExportSerializer(serializers.Serializer):
    file_type = serializers.ChoiceField(choices=["csv", "xlsx"])
