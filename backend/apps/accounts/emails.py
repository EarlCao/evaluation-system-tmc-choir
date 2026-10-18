"""Transactional emails (console backend in dev, SMTP in prod). Plain text with 6-digit OTP."""

import logging
import threading

import environ
from django.conf import settings
from django.core.mail import get_connection, send_mail

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
    """Deliver synchronously in test environments (locmem) so outbox assertions work,
    and asynchronously in daemon threads for dev/prod so SMTP never blocks HTTP requests."""
    if "locmem" in settings.EMAIL_BACKEND:
        deliver_fn()
    else:
        threading.Thread(target=deliver_fn, daemon=True).start()


def _send_transactional_email(*, subject: str, message: str, recipient: str) -> None:
    """Send email via configured backend; dynamically picks up .env SMTP credentials in dev
    without requiring a container restart, and never crashes the request with 500."""
    if "locmem" in settings.EMAIL_BACKEND:
        send_mail(subject=subject, message=message, from_email=None, recipient_list=[recipient])
        return

    env = environ.Env()
    env_file = getattr(settings, "REPO_ROOT", None)
    if env_file is not None and (env_file / ".env").exists():
        environ.Env.read_env(env_file / ".env", overwrite=True)

    host_user = (env("EMAIL_HOST_USER", default="") or getattr(settings, "EMAIL_HOST_USER", "")).strip()
    host_password = (
        env("EMAIL_HOST_PASSWORD", default="") or getattr(settings, "EMAIL_HOST_PASSWORD", "")
    ).strip().replace(" ", "")
    host = (env("EMAIL_HOST", default="") or getattr(settings, "EMAIL_HOST", "smtp.gmail.com")).strip()
    port = env.int("EMAIL_PORT", default=getattr(settings, "EMAIL_PORT", 587))
    use_tls = env.bool("EMAIL_USE_TLS", default=getattr(settings, "EMAIL_USE_TLS", True))
    use_ssl = env.bool("EMAIL_USE_SSL", default=getattr(settings, "EMAIL_USE_SSL", False))

    if host_user and host_password:
        try:
            conn = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=host_user,
                password=host_password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=10,
            )
            send_mail(
                subject=subject,
                message=message,
                from_email=host_user,
                recipient_list=[recipient],
                connection=conn,
            )
            return
        except Exception:
            logger.exception("SMTP email delivery failed; falling back to console output.")

    conn = get_connection(backend="django.core.mail.backends.console.EmailBackend")
    send_mail(
        subject=subject,
        message=message,
        from_email=host_user or settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        connection=conn,
    )


def send_password_reset_email(user) -> None:
    otp = make_email_otp(user, purpose="password_reset")
    link = _link(f"/reset-password/{encode_uid(user)}/{password_reset_token.make_token(user)}")
    system_name = get_settings().system_name

    def _deliver():
        _send_transactional_email(
            subject=f"{system_name}: reset your password (OTP: {otp})",
            message=(
                f"Hello {user.get_short_name()},\n\n"
                f"Your 6-digit OTP password reset code is: {otp}\n\n"
                f"Enter this OTP code on the password reset page, or use this link to choose a new password:\n{link}\n\n"
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
            subject=f"{system_name}: confirm your email address (OTP: {otp})",
            message=(
                f"Hello {user.get_short_name()},\n\n"
                f"Your 6-digit OTP verification code is: {otp}\n\n"
                f"Enter this OTP code on the registration page, or confirm your email address using this link:\n{link}\n"
            ),
            recipient=user.email,
        )

    _dispatch_email(_deliver)


def send_pending_registration_otp_email(*, email: str, username: str, first_name: str) -> None:
    otp = make_pending_registration_otp(email, username)
    system_name = get_settings().system_name
    greeting = first_name.strip() or username

    def _deliver():
        _send_transactional_email(
            subject=f"{system_name}: confirm your email address (OTP: {otp})",
            message=(
                f"Hello {greeting},\n\n"
                f"Your 6-digit OTP verification code is: {otp}\n\n"
                "Enter this 6-digit OTP code on the Create Account page to verify your email and complete account creation.\n"
            ),
            recipient=email,
        )

    _dispatch_email(_deliver)

