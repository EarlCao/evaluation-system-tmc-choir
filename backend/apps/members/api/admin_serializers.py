"""Super Admin member serializers (identities and account state are fine here: admin only)."""

from rest_framework import serializers

from apps.accounts.constants import UserRole, UserStatus

from ..models import VoiceSection


class AdminVoiceSectionSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, default=None)

    class Meta:
        model = VoiceSection
        fields = ["id", "name", "sort_order", "is_active", "member_count"]


class AdminProfileSerializer(serializers.Serializer):
    voice_section = AdminVoiceSectionSerializer()
    is_evaluable = serializers.BooleanField()
    joined_choir_on = serializers.DateField(allow_null=True)
    bio = serializers.CharField()


class AdminMemberSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    display_name = serializers.CharField()
    role = serializers.CharField()
    status = serializers.CharField()
    email_verified = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)
    approved_at = serializers.DateTimeField(allow_null=True)
    profile = serializers.SerializerMethodField()

    def get_email_verified(self, obj) -> bool:
        return obj.email_verified_at is not None

    def get_profile(self, obj) -> dict | None:
        profile = getattr(obj, "member_profile", None)
        return AdminProfileSerializer(profile).data if profile else None


class AdminMemberFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=100, default="")
    status = serializers.ChoiceField(
        choices=UserStatus.choices, required=False, allow_blank=True, default=""
    )
    role = serializers.ChoiceField(
        choices=UserRole.choices, required=False, allow_blank=True, default=""
    )
    voice_section = serializers.IntegerField(required=False, min_value=1)


class AdminProfileUpdateSerializer(serializers.Serializer):
    voice_section = serializers.IntegerField(required=False, min_value=1)
    is_evaluable = serializers.BooleanField(required=False)
    joined_choir_on = serializers.DateField(required=False, allow_null=True)


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=UserStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class RoleChangeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRole.choices)


class VoiceSectionWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50, required=False)
    sort_order = serializers.IntegerField(min_value=0, required=False)
    is_active = serializers.BooleanField(required=False)
