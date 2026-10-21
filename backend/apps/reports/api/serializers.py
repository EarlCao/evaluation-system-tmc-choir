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
    feedback_received = serializers.IntegerField()


class MemberCountsSerializer(serializers.Serializer):
    registered = serializers.IntegerField()
    active = serializers.IntegerField()
    pending = serializers.IntegerField()
    suspended = serializers.IntegerField()
    deactivated = serializers.IntegerField()


class CycleCountsSerializer(serializers.Serializer):
    DRAFT = serializers.IntegerField()
    OPEN = serializers.IntegerField()
    CLOSED = serializers.IntegerField()
    ARCHIVED = serializers.IntegerField()


class AdminOpenCycleSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField()
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    evaluation_scope = serializers.CharField()
    evaluations_submitted = serializers.IntegerField()
    possible_pairs = serializers.IntegerField()
    submitted_pairs = serializers.IntegerField()
    participating_members = serializers.IntegerField()
    participation_percent = serializers.FloatField(allow_null=True)


class AdminDashboardSerializer(serializers.Serializer):
    members = MemberCountsSerializer()
    evaluations_submitted = serializers.IntegerField()
    needs_moderation = serializers.IntegerField()
    cycles = CycleCountsSerializer()
    open_cycle = AdminOpenCycleSerializer(allow_null=True)


class MyDataExportSerializer(serializers.Serializer):
    account = serializers.DictField()
    member_profile = serializers.DictField(allow_null=True)
    evaluations_given = serializers.ListField(child=serializers.DictField())
    feedback_received = serializers.DictField()
