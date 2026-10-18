from rest_framework import serializers

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
                "Username must contain only lowercase letters (a-z), numbers (0-9), and underscores (_)."
            )
        },
    )
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    voice_section = serializers.IntegerField(min_value=1)


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

    class Meta:
        model = MemberProfile
        fields = ["public_id", "first_name", "last_name", "display_name", "voice_section"]


class MemberDetailSerializer(DirectoryEntrySerializer):
    is_self = serializers.SerializerMethodField()

    class Meta(DirectoryEntrySerializer.Meta):
        fields = [*DirectoryEntrySerializer.Meta.fields, "bio", "joined_choir_on", "is_self"]

    def get_is_self(self, obj: MemberProfile) -> bool:
        request = self.context.get("request")
        return bool(request and request.user.pk == obj.user_id)


class OwnProfileUpdateSerializer(serializers.Serializer):
    bio = serializers.CharField(max_length=500, allow_blank=True, trim_whitespace=True)
