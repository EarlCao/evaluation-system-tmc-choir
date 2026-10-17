from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Separate salt from password reset; invalidated once the email is verified or the
    status changes (so a link works only once)."""

    key_salt = "apps.accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp) -> str:
        return f"{user.pk}{user.email}{user.status}{user.email_verified_at}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()
password_reset_token = default_token_generator


def encode_uid(user) -> str:
    return urlsafe_base64_encode(force_bytes(user.pk))


def decode_uid(uidb64: str) -> int | None:
    try:
        return int(force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError):
        return None
