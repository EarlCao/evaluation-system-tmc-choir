import hashlib
import hmac
import time

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

OTP_STEP_SECONDS = 900  # 15-minute window (current + previous step = up to 30 minutes validity)


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Separate salt from password reset; invalidated once the email is verified or the
    status changes (so a link works only once)."""

    key_salt = "apps.accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp) -> str:
        return f"{user.pk}{user.email}{user.status}{user.email_verified_at}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()
password_reset_token = default_token_generator


def _otp_state(user, purpose: str) -> str:
    if purpose == "verify_email":
        return f"{user.status}:{user.email_verified_at}"
    return f"{user.password}:{user.status}"


def make_email_otp(user, purpose: str = "verify_email", time_step: int | None = None) -> str:
    """Deterministic, single-use 6-digit OTP tied to the user's current verification/password state."""
    step = int(time.time() // OTP_STEP_SECONDS) if time_step is None else time_step
    payload = f"otp:{purpose}:{user.pk}:{user.email.lower()}:{_otp_state(user, purpose)}:{step}"
    digest = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest()
    code = int.from_bytes(digest[:4], "big") % 1_000_000
    return f"{code:06d}"


def verify_email_otp(user, otp: str, purpose: str = "verify_email") -> bool:
    """Constant-time verification of a 6-digit OTP across the current and previous time step."""
    cleaned = otp.strip()
    if len(cleaned) != 6 or not cleaned.isdigit():
        return False
    now_step = int(time.time() // OTP_STEP_SECONDS)
    return any(
        hmac.compare_digest(cleaned, make_email_otp(user, purpose=purpose, time_step=step))
        for step in (now_step, now_step - 1)
    )


def encode_uid(user) -> str:
    return urlsafe_base64_encode(force_bytes(user.pk))


def decode_uid(uidb64: str) -> int | None:
    try:
        return int(force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError):
        return None

