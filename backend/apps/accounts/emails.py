"""Transactional emails (console backend in dev, SMTP in prod). Plain text only."""

from django.conf import settings
from django.core.mail import send_mail

from apps.system.selectors import get_settings

from .tokens import email_verification_token, encode_uid, password_reset_token


def _link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def send_password_reset_email(user) -> None:
    link = _link(f"/reset-password/{encode_uid(user)}/{password_reset_token.make_token(user)}")
    system_name = get_settings().system_name
    send_mail(
        subject=f"{system_name}: reset your password",
        message=(
            f"Hello {user.get_short_name()},\n\n"
            f"Use this link to choose a new password:\n{link}\n\n"
            "If you did not ask for this, you can ignore this email."
        ),
        from_email=None,
        recipient_list=[user.email],
    )


def send_verification_email(user) -> None:
    link = _link(f"/verify-email/{encode_uid(user)}/{email_verification_token.make_token(user)}")
    system_name = get_settings().system_name
    send_mail(
        subject=f"{system_name}: confirm your email address",
        message=(
            f"Hello {user.get_short_name()},\n\n"
            f"Confirm your email address to activate your account:\n{link}\n"
        ),
        from_email=None,
        recipient_list=[user.email],
    )
