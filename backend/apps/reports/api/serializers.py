from rest_framework import serializers


class MemberDashboardSerializer(serializers.Serializer):
    active_members = serializers.IntegerField()
    voice_section = serializers.CharField(allow_null=True)
