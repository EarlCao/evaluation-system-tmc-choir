"""Transactional emails (console backend in dev, SMTP in prod). Plain text with 6-digit OTP."""

from django.conf import settings
from django.core.mail import send_mail

from apps.system.selectors import get_settings

from .tokens import (
    email_verification_token,
    encode_uid,
    make_email_otp,
    make_pending_registration_otp,
    password_reset_token,
)


def _link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def send_password_reset_email(user) -> None:
    otp = make_email_otp(user, purpose="password_reset")
    link = _link(f"/reset-password/{encode_uid(user)}/{password_reset_token.make_token(user)}")
    system_name = get_settings().system_name
    send_mail(
        subject=f"{system_name}: reset your password (OTP: {otp})",
        message=(
            f"Hello {user.get_short_name()},\n\n"
            f"Your 6-digit OTP password reset code is: {otp}\n\n"
            f"Enter this OTP code on the password reset page, or use this link to choose a new password:\n{link}\n\n"
            "If you did not ask for this, you can ignore this email."
        ),
        from_email=None,
        recipient_list=[user.email],
    )


def send_verification_email(user) -> None:
    otp = make_email_otp(user, purpose="verify_email")
    link = _link(f"/verify-email/{encode_uid(user)}/{email_verification_token.make_token(user)}")
    system_name = get_settings().system_name
    send_mail(
        subject=f"{system_name}: confirm your email address (OTP: {otp})",
        message=(
            f"Hello {user.get_short_name()},\n\n"
            f"Your 6-digit OTP verification code is: {otp}\n\n"
            f"Enter this OTP code on the registration page, or confirm your email address using this link:\n{link}\n"
        ),
        from_email=None,
        recipient_list=[user.email],
    )


def send_pending_registration_otp_email(*, email: str, username: str, first_name: str) -> None:
    otp = make_pending_registration_otp(email, username)
    system_name = get_settings().system_name
    greeting = first_name.strip() or username
    send_mail(
        subject=f"{system_name}: confirm your email address (OTP: {otp})",
        message=(
            f"Hello {greeting},\n\n"
            f"Your 6-digit OTP verification code is: {otp}\n\n"
            "Enter this 6-digit OTP code on the Create Account page to verify your email and complete account creation.\n"
        ),
        from_email=None,
        recipient_list=[email],
    )

