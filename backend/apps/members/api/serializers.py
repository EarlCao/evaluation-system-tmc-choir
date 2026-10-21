from rest_framework import serializers

from .. import selectors
from ..models import MemberProfile, VoiceSection


class VoiceSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceSection
        fields = ["id", "name"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    username = serializers.RegexField(
        r"^[a-z0-9_]+\Z",
        max_length=150,
        error_messages={
            "invalid": (
                "Username must contain only lowercase letters (a-z), numbers (0-9), "
                "and underscores (_)."
            )
        },
    )
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(
        max_length=128, trim_whitespace=False, write_only=True, required=False
    )
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    voice_section = serializers.IntegerField(min_value=1)
    is_officer = serializers.BooleanField(required=False, default=False)
    officer_position = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )

    def validate(self, attrs):
        confirm = attrs.pop("confirm_password", None)
        if confirm is not None and confirm != attrs.get("password"):
            raise serializers.ValidationError({"confirm_password": ["The passwords don't match."]})
        is_officer = bool(attrs.get("is_officer", False))
        position = str(attrs.get("officer_position", "")).strip()
        if is_officer and not position:
            raise serializers.ValidationError(
                {"officer_position": ["Enter the officer position you handle."]}
            )
        attrs["is_officer"] = is_officer
        attrs["officer_position"] = position if is_officer else ""
        return attrs


class RegistrationResultSerializer(serializers.Serializer):
    status = serializers.CharField()
    detail = serializers.CharField()


class DirectoryEntrySerializer(serializers.ModelSerializer):
    """MEM-01 basic profile information. No email, username or account details."""

    public_id = serializers.UUIDField(source="user.public_id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    display_name = serializers.CharField(source="user.display_name", read_only=True)
    voice_section = VoiceSectionSerializer(read_only=True)
    has_self_evaluation = serializers.BooleanField(read_only=True, default=False)
    self_evaluation_summary = serializers.CharField(read_only=True, default="")
    is_evaluated = serializers.BooleanField(
        source="is_evaluated_by_viewer", read_only=True, default=False
    )
    evaluation_id = serializers.UUIDField(
        source="evaluation_id_by_viewer", read_only=True, default=None, allow_null=True
    )

    class Meta:
        model = MemberProfile
        fields = [
            "public_id",
            "first_name",
            "last_name",
            "display_name",
            "voice_section",
            "is_officer",
            "officer_position",
            "has_self_evaluation",
            "self_evaluation_summary",
            "is_evaluated",
            "evaluation_id",
        ]


class MemberDetailSerializer(DirectoryEntrySerializer):
    is_self = serializers.SerializerMethodField()
    self_evaluation = serializers.SerializerMethodField()

    class Meta(DirectoryEntrySerializer.Meta):
        fields = [
            *DirectoryEntrySerializer.Meta.fields,
            "bio",
            "joined_choir_on",
            "is_self",
            "self_evaluation",
        ]

    def get_is_self(self, obj: MemberProfile) -> bool:
        request = self.context.get("request")
        return bool(request and request.user.pk == obj.user_id)

    def get_self_evaluation(self, obj: MemberProfile) -> dict | None:
        return selectors.get_public_self_evaluation(user=obj.user)


class OwnProfileUpdateSerializer(serializers.Serializer):
    bio = serializers.CharField(
        max_length=500, required=False, allow_blank=True, trim_whitespace=True
    )
    is_officer = serializers.BooleanField(required=False)
    officer_position = serializers.CharField(
        max_length=100, required=False, allow_blank=True, trim_whitespace=True
    )
