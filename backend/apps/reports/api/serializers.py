from rest_framework import serializers


class OpenCycleProgressSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField()
    ends_at = serializers.DateTimeField()
    evaluations_given = serializers.IntegerField()
    members_left = serializers.IntegerField()


class MemberDashboardSerializer(serializers.Serializer):
    active_members = serializers.IntegerField()
    voice_section = serializers.CharField(allow_null=True)
    open_cycle = OpenCycleProgressSerializer(allow_null=True)
