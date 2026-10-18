"""Member-facing serializers (explicit field whitelists, never ``__all__``)."""

from rest_framework import serializers

from ..models import User


class MeSerializer(serializers.ModelSerializer):
    """The logged-in user's own account. Only names are writable."""

    is_super_admin = serializers.BooleanField(read_only=True)
    email_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "public_id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "status",
            "is_super_admin",
            "email_verified",
            "date_joined",
        ]
        read_only_fields = [
            "public_id",
            "username",
            "email",
            "role",
            "status",
            "is_super_admin",
            "email_verified",
            "date_joined",
        ]

    def get_email_verified(self, obj: User) -> bool:
        return obj.email_verified_at is not None


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, help_text="Username or email")
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)


class EmailVerificationSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class DeactivateAccountSerializer(serializers.Serializer):
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

