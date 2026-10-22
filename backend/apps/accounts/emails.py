"""Transactional emails (SMTP or HTTPS in prod). Plain text with 6-digit OTP."""

import logging

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

logger = logging.getLogger(__name__)


def _link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _dispatch_email(deliver_fn) -> None:
    """Complete delivery before success; daemon threads can lose mail on process exit."""
    deliver_fn()


def _send_transactional_email(*, subject: str, message: str, recipient: str) -> None:
    """Never fall back to logging password-reset tokens or OTPs when delivery fails."""
    from apps.core.exceptions import DomainError

    try:
        send_mail(subject=subject, message=message, from_email=None, recipient_list=[recipient])
    except Exception as exc:
        logger.error("Transactional email delivery failed (%s).", type(exc).__name__)
        error = DomainError("Email delivery is unavailable. Please try again later.")
        error.status_code = 503
        raise error from exc


def send_password_reset_email(user) -> None:
    otp = make_email_otp(user, purpose="password_reset")
    link = _link(f"/reset-password/{encode_uid(user)}/{password_reset_token.make_token(user)}")
    system_name = get_settings().system_name

    def _deliver():
        _send_transactional_email(
            subject=f"{system_name}: reset your password",
            message=(
                f"Hello {user.get_short_name()},\n\n"
                f"Your 6-digit OTP password reset code is: {otp}\n\n"
                "Enter this OTP code on the password reset page, or use this link "
                f"to choose a new password:\n{link}\n\n"
                "If you did not ask for this, you can ignore this email."
            ),
            recipient=user.email,
        )

    _dispatch_email(_deliver)


def send_verification_email(user) -> None:
    otp = make_email_otp(user, purpose="verify_email")
    link = _link(f"/verify-email/{encode_uid(user)}/{email_verification_token.make_token(user)}")
    system_name = get_settings().system_name

    def _deliver():
        _send_transactional_email(
            subject=f"{system_name}: confirm your email address",
            message=(
                f"Hello {user.get_short_name()},\n\n"
                f"Your 6-digit OTP verification code is: {otp}\n\n"
                "Enter this OTP code on the registration page, or confirm your email "
                f"address using this link:\n{link}\n"
            ),
            recipient=user.email,
        )

    _dispatch_email(_deliver)


def send_pending_registration_otp_email(
    *, email: str, username: str, first_name: str, nonce: str = ""
) -> None:
    otp = make_pending_registration_otp(email, username, nonce=nonce)
    system_name = get_settings().system_name
    greeting = first_name.strip() or username

    def _deliver():
        _send_transactional_email(
            subject=f"{system_name}: confirm your email address",
            message=(
                f"Hello {greeting},\n\n"
                f"Your 6-digit OTP verification code is: {otp}\n\n"
                "Enter this 6-digit OTP code on the Create Account page to verify your "
                "email and complete account creation.\n"
            ),
            recipient=email,
        )

    _dispatch_email(_deliver)
