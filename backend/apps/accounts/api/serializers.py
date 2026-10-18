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
    portal = serializers.ChoiceField(choices=["member", "admin"], required=False)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)
    confirm_password = serializers.CharField(
        max_length=128, trim_whitespace=False, write_only=True, required=False
    )

    def validate(self, attrs):
        confirm = attrs.pop("confirm_password", None)
        if confirm is not None and confirm != attrs.get("new_password"):
            raise serializers.ValidationError(
                {"confirm_password": ["The passwords don't match."]}
            )
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    token = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    otp = serializers.CharField(max_length=12, required=False, allow_blank=True, default="")
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)
    confirm_password = serializers.CharField(
        max_length=128, trim_whitespace=False, write_only=True, required=False
    )

    def validate(self, attrs):
        confirm = attrs.pop("confirm_password", None)
        if confirm is not None and confirm != attrs.get("new_password"):
            raise serializers.ValidationError(
                {"confirm_password": ["The passwords don't match."]}
            )
        return attrs


class EmailVerificationSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    token = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    otp = serializers.CharField(max_length=12, required=False, allow_blank=True, default="")


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class DeactivateAccountSerializer(serializers.Serializer):
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

