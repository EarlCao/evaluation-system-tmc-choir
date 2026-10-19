"""Public write API of the accounts module."""

import hashlib
import hmac
import re

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status as http_status

from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, DomainError, ValidationError
from apps.system.constants import RegistrationMode
from apps.system.selectors import get_settings

from . import emails, events
from .constants import INVALID_CREDENTIALS_MESSAGE, INVALID_LINK_MESSAGE, UserRole, UserStatus
from .models import User
from .tokens import (
    decode_uid,
    email_verification_token,
    password_reset_token,
    verify_email_otp,
    verify_pending_registration_otp,
)

EDITABLE_PROFILE_FIELDS = ("first_name", "last_name", "display_name")
USERNAME_PATTERN = re.compile(r"^[a-z0-9_]+\Z")
INVALID_OTP_MESSAGE = "Invalid or expired OTP code."

_PENDING_REGISTRATIONS: dict[str, dict] = {}
_profile_creator_callback = None


def register_profile_creator(callback) -> None:
    """Register callback from members.services to create MemberProfile when OTP is verified."""
    global _profile_creator_callback
    _profile_creator_callback = callback


class InvalidCredentials(DomainError):
    status_code = http_status.HTTP_400_BAD_REQUEST
    code = "invalid_credentials"
    default_message = INVALID_CREDENTIALS_MESSAGE


def identifier_hash(identifier: str) -> str:
    """Keyed hash of a login/reset identifier, for correlating attempts in the audit log."""
    digest = hmac.new(
        settings.SECRET_KEY.encode(), identifier.strip().lower().encode(), hashlib.sha256
    )
    return digest.hexdigest()[:16]


def _check_password_strength(password: str, user: User) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError(fields={"password": exc.messages}) from exc


import uuid


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
def cleanup_unverified_registration(*, email: str, username: str) -> None:
    """Remove or release any unverified member record that never completed OTP verification
    or logged in. Handles AuditLog.actor PROTECT foreign keys gracefully."""
    stale_users = list(
        User.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=username),
            role=UserRole.MEMBER,
            email_verified_at__isnull=True,
            approved_at__isnull=True,
            last_login__isnull=True,
        )
    )
    for stale in stale_users:
        try:
            with transaction.atomic():
                stale.delete()
        except Exception:
            if hasattr(stale, "member_profile"):
                stale.member_profile.delete()
            suffix = f"{stale.pk}_{uuid.uuid4().hex[:8]}"
            stale.username = f"_unverified_{suffix}"
            stale.email = f"_unverified_{suffix}@invalid.local"
            stale.status = UserStatus.DEACTIVATED
            stale.save(update_fields=["username", "email", "status", "updated_at"])


def _validate_registration_inputs(
    *, email: str, username: str, password: str, first_name: str, last_name: str
) -> tuple[str, str, str]:
    mode = get_settings().registration_mode
    if mode == RegistrationMode.CLOSED:
        raise BusinessRuleViolation("Registration is currently closed.")

    email = User.objects.normalize_email(email).strip().lower()
    username = User.normalize_username(username.strip())
    errors: dict[str, list[str]] = {}
    if User.objects.filter(email__iexact=email).exists():
        errors["email"] = ["An account with this email already exists."]
    if not USERNAME_PATTERN.match(username):
        errors["username"] = [
            "Username must contain only lowercase letters (a-z), numbers (0-9), and underscores (_)."
        ]
    elif User.objects.filter(username__iexact=username).exists():
        errors["username"] = ["This username is already taken."]
    if errors:
        raise ValidationError(fields=errors)

    candidate = User(email=email, username=username, first_name=first_name, last_name=last_name)
    _check_password_strength(password, candidate)
    return mode, email, username


def stage_pending_registration(
    *,
    email: str,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    voice_section_id: int,
    is_officer: bool = False,
    officer_position: str = "",
) -> dict[str, str]:
    """Validate registration inputs and send a 6-digit OTP email WITHOUT creating the User row
    in the database until the OTP is verified."""
    clean_email = User.objects.normalize_email(email).strip().lower()
    clean_username = User.normalize_username(username.strip())
    cleanup_unverified_registration(email=clean_email, username=clean_username)
    _mode, clean_email, clean_username = _validate_registration_inputs(
        email=clean_email,
        username=clean_username,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    record = {
        "email": clean_email,
        "username": clean_username,
        "password": password,
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "voice_section_id": voice_section_id,
        "is_officer": bool(is_officer),
        "officer_position": officer_position.strip() if is_officer else "",
    }
    _PENDING_REGISTRATIONS[clean_email] = record
    try:
        cache.set(f"pending_reg:{clean_email}", record, timeout=1800)
    except Exception:
        pass
    emails.send_pending_registration_otp_email(
        email=clean_email, username=clean_username, first_name=first_name
    )
    return {
        "status": UserStatus.PENDING,
        "detail": (
            f"We sent a 6-digit OTP verification code to {clean_email}. "
            "Enter the OTP code below to finish creating your account."
        ),
    }


def create_user(
    *, email: str, username: str, password: str, first_name: str, last_name: str
) -> User:
    """AUTH-01 / AUTH-03: create a member account. The initial status depends on
    ``registration_mode``: OPEN → ACTIVE, APPROVAL / EMAIL_VERIFICATION → PENDING,
    CLOSED → refused. Called by ``members.services.register_member`` (ADR-004)."""
    mode, email, username = _validate_registration_inputs(
        email=email,
        username=username,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )

    status = UserStatus.ACTIVE if mode == RegistrationMode.OPEN else UserStatus.PENDING
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=first_name.strip(),
                last_name=last_name.strip(),
                role=UserRole.MEMBER,
                status=status,
            )
    except IntegrityError as exc:  # lost a race with a concurrent registration
        raise ValidationError(
            fields={"username": ["This username or email is already in use."]}
        ) from exc

    if mode == RegistrationMode.EMAIL_VERIFICATION:
        transaction.on_commit(lambda: emails.send_verification_email(user))
    publish(
        events.UserRegistered(
            actor_id=user.pk, target_id=user.pk, status=status, registration_mode=mode
        )
    )
    return user


def create_active_member_account(
    *, actor, email: str, username: str, password: str, first_name: str, last_name: str
) -> User:
    """An ACTIVE member account created by a Super Admin or a dev seed (``actor`` None),
    bypassing the registration mode. Same validation as registration; audited."""
    email = User.objects.normalize_email(email).strip().lower()
    username = User.normalize_username(username.strip())
    if (
        User.objects.filter(email__iexact=email).exists()
        or User.objects.filter(username__iexact=username).exists()
    ):
        raise ValidationError(fields={"username": ["A user with this username or email exists."]})
    candidate = User(email=email, username=username, first_name=first_name, last_name=last_name)
    _check_password_strength(password, candidate)
    user = User.objects.create_user(
        email=email,
        username=username,
        password=password,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        role=UserRole.MEMBER,
        status=UserStatus.ACTIVE,
    )
    publish(
        events.UserRegistered(
            actor_id=getattr(actor, "pk", None),
            target_id=user.pk,
            status=UserStatus.ACTIVE,
            registration_mode="ADMIN_CREATED",
        )
    )
    return user


def create_super_admin(
    *, email: str, username: str, password: str, first_name: str, last_name: str
) -> User:
    """Bootstrap / emergency creation of a Super Admin (``manage.py create_super_admin``)."""
    candidate = User(email=email, username=username, first_name=first_name, last_name=last_name)
    _check_password_strength(password, candidate)
    if (
        User.objects.filter(email__iexact=email).exists()
        or User.objects.filter(username__iexact=username).exists()
    ):
        raise ValidationError(fields={"username": ["A user with this username or email exists."]})
    with transaction.atomic():
        user = User.objects.create_superuser(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email_verified_at=timezone.now(),
        )
        publish(events.SuperAdminCreated(target_id=user.pk))
    return user


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
def authenticate_and_login(
    *, request, identifier: str, password: str, portal: str | None = None
) -> User:
    """AUTH-02. Every failure (unknown account, wrong password, not ACTIVE) raises the same
    ``InvalidCredentials`` error. Django's ``login`` rotates the session key."""
    user = auth.authenticate(request, username=identifier, password=password)
    if user is None:
        match = User.objects.filter(username__iexact=identifier.strip()).first() or (
            User.objects.filter(email__iexact=identifier.strip()).first()
        )
        publish(
            events.LoginFailed(
                target_id=match.pk if match else None,
                identifier_hash=identifier_hash(identifier),
            )
        )
        raise InvalidCredentials()

    if portal == "member" and user.role == UserRole.SUPER_ADMIN:
        raise InvalidCredentials("Super Admin accounts must sign in at /admin.")
    if portal == "admin" and user.role != UserRole.SUPER_ADMIN:
        raise InvalidCredentials("Only Super Admin accounts can sign in here.")

    auth.login(request, user)
    publish(events.LoggedIn(actor_id=user.pk, target_id=user.pk))
    return user


def logout(*, request) -> None:
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        publish(events.LoggedOut(actor_id=user.pk, target_id=user.pk))
    auth.logout(request)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def change_password(*, request, user: User, old_password: str, new_password: str) -> None:
    """Keeps the current session; every other session of the user is invalidated."""
    if not user.check_password(old_password):
        raise ValidationError(fields={"old_password": ["Your current password is incorrect."]})
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError(fields={"new_password": exc.messages}) from exc
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    auth.update_session_auth_hash(request, user)
    publish(events.PasswordChanged(actor_id=user.pk, target_id=user.pk))


def request_password_reset(*, email: str) -> None:
    """Always succeeds silently (no account enumeration). Only ACTIVE users get an email."""
    user = User.objects.filter(email__iexact=email.strip(), status=UserStatus.ACTIVE).first()
    if user is not None:
        transaction.on_commit(lambda: emails.send_password_reset_email(user))
    publish(
        events.PasswordResetRequested(
            target_id=user.pk if user else None, identifier_hash=identifier_hash(email)
        )
    )


def _user_from_link(uidb64: str, token: str, generator) -> User:
    uid = decode_uid(uidb64)
    user = User.objects.filter(pk=uid).first() if uid is not None else None
    if user is None or not generator.check_token(user, token):
        raise ValidationError(INVALID_LINK_MESSAGE, fields={"token": [INVALID_LINK_MESSAGE]})
    return user


def confirm_password_reset(
    *,
    uidb64: str = "",
    token: str = "",
    new_password: str,
    email: str = "",
    otp: str = "",
) -> User:
    if email or otp:
        user = User.objects.filter(email__iexact=email.strip(), status=UserStatus.ACTIVE).first()
        if user is None or not verify_email_otp(user, otp, purpose="password_reset"):
            raise ValidationError(INVALID_OTP_MESSAGE, fields={"otp": [INVALID_OTP_MESSAGE]})
    else:
        user = _user_from_link(uidb64, token, password_reset_token)
        if user.status != UserStatus.ACTIVE:
            raise ValidationError(INVALID_LINK_MESSAGE, fields={"token": [INVALID_LINK_MESSAGE]})
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError(fields={"new_password": exc.messages}) from exc
    user.set_password(new_password)  # also invalidates the token/OTP and all existing sessions
    user.save(update_fields=["password", "updated_at"])
    publish(events.PasswordResetCompleted(actor_id=user.pk, target_id=user.pk))
    return user


# ---------------------------------------------------------------------------
# Email verification & profile
# ---------------------------------------------------------------------------
def verify_email(
    *, uidb64: str = "", token: str = "", email: str = "", otp: str = ""
) -> User:
    """AUTH-03: confirms the address via 6-digit OTP or verification link and creates/activates
    a PENDING account. Single-use."""
    if email or otp:
        clean_email = User.objects.normalize_email(email).strip().lower()
        pending = _PENDING_REGISTRATIONS.get(clean_email)
        if pending is None:
            try:
                pending = cache.get(f"pending_reg:{clean_email}")
            except Exception:
                pending = None
        if pending is not None:
            if not verify_pending_registration_otp(clean_email, pending["username"], otp):
                raise ValidationError(INVALID_OTP_MESSAGE, fields={"otp": [INVALID_OTP_MESSAGE]})
            cleanup_unverified_registration(email=clean_email, username=pending["username"])
            with transaction.atomic():
                user = create_user(
                    email=pending["email"],
                    username=pending["username"],
                    password=pending["password"],
                    first_name=pending["first_name"],
                    last_name=pending["last_name"],
                )
                if _profile_creator_callback is not None:
                    _profile_creator_callback(
                        user,
                        pending["voice_section_id"],
                        is_officer=bool(pending.get("is_officer", False)),
                        officer_position=str(pending.get("officer_position", "")),
                    )
                user.email_verified_at = timezone.now()
                if user.status == UserStatus.PENDING:
                    user.status = UserStatus.ACTIVE
                user.save(update_fields=["email_verified_at", "status", "updated_at"])
            _PENDING_REGISTRATIONS.pop(clean_email, None)
            try:
                cache.delete(f"pending_reg:{clean_email}")
            except Exception:
                pass
            publish(events.EmailVerified(actor_id=user.pk, target_id=user.pk))
            return user

        user = User.objects.filter(email__iexact=clean_email).first()
        if user is None or not verify_email_otp(user, otp, purpose="verify_email"):
            raise ValidationError(INVALID_OTP_MESSAGE, fields={"otp": [INVALID_OTP_MESSAGE]})
    else:
        user = _user_from_link(uidb64, token, email_verification_token)
    user.email_verified_at = timezone.now()
    if user.status == UserStatus.PENDING:
        user.status = UserStatus.ACTIVE
    user.save(update_fields=["email_verified_at", "status", "updated_at"])
    publish(events.EmailVerified(actor_id=user.pk, target_id=user.pk))
    return user


def send_verification_otp(user: User) -> None:
    """Send a 6-digit OTP verification email for a newly registered account."""
    transaction.on_commit(lambda: emails.send_verification_email(user))


def update_own_profile(*, user: User, **changes) -> User:
    """AUTH-04: members may change their names only (email changes need re-verification
    and are not supported in v1)."""
    unknown = sorted(set(changes) - set(EDITABLE_PROFILE_FIELDS))
    if unknown:
        raise ValidationError(fields={f: ["This field cannot be changed."] for f in unknown})
    changed = tuple(
        f for f in EDITABLE_PROFILE_FIELDS if f in changes and getattr(user, f) != changes[f]
    )
    if not changed:
        return user
    for field in changed:
        setattr(user, field, changes[field].strip())
    if not user.first_name or not user.last_name:
        raise ValidationError(fields={"first_name": ["First and last name are required."]})
    user.save(update_fields=[*changed, "updated_at"])
    publish(events.ProfileUpdated(actor_id=user.pk, target_id=user.pk, changed_fields=changed))
    return user


def deactivate_own_account(*, request, user: User, password: str, reason: str = "") -> User:
    """AUTH-04 / step 6.4: allow an active member to deactivate their own account after
    confirming their password. Historical evaluations are preserved (BR-06)."""
    if not user.check_password(password):
        raise ValidationError(fields={"password": ["Your current password is incorrect."]})
    if (
        user.role == UserRole.SUPER_ADMIN
        and user.status == UserStatus.ACTIVE
        and _active_super_admin_count() <= 1
    ):
        raise BusinessRuleViolation("The last active Super Admin cannot be deactivated.")
    before = user.status
    user.status = UserStatus.DEACTIVATED
    user.save(update_fields=["status", "updated_at"])
    publish(
        events.UserStatusChanged(
            actor_id=user.pk,
            target_id=user.pk,
            changes=(("status", before, UserStatus.DEACTIVATED),),
            reason=reason.strip() or "self_deactivated",
        )
    )
    auth.logout(request)
    return user


# ---------------------------------------------------------------------------
# Super Admin account management (API + UI arrive in step 4.2)
# ---------------------------------------------------------------------------
def _active_super_admin_count() -> int:
    return User.objects.filter(role=UserRole.SUPER_ADMIN, status=UserStatus.ACTIVE).count()


def set_user_status(*, actor: User, user: User, status: str, reason: str = "") -> User:
    """AUTH-05: activate, suspend or deactivate an account."""
    if status not in UserStatus.values:
        raise ValidationError(fields={"status": ["Unknown status."]})
    if user.pk == actor.pk:
        raise BusinessRuleViolation("You cannot change the status of your own account.")
    if user.status == status:
        return user
    if (
        user.role == UserRole.SUPER_ADMIN
        and user.status == UserStatus.ACTIVE
        and _active_super_admin_count() <= 1
    ):
        raise BusinessRuleViolation("The last active Super Admin cannot be deactivated.")

    before = user.status
    user.status = status
    fields = ["status", "updated_at"]
    if before == UserStatus.PENDING and status == UserStatus.ACTIVE:
        user.approved_by, user.approved_at = actor, timezone.now()
        fields += ["approved_by", "approved_at"]
    user.save(update_fields=fields)
    publish(
        events.UserStatusChanged(
            actor_id=actor.pk,
            target_id=user.pk,
            changes=(("status", before, status),),
            reason=reason,
        )
    )
    return user


def approve_user(*, actor: User, user: User) -> User:
    """AUTH-03 (APPROVAL mode): activate a PENDING registration."""
    if user.status != UserStatus.PENDING:
        raise BusinessRuleViolation("Only pending accounts can be approved.")
    return set_user_status(actor=actor, user=user, status=UserStatus.ACTIVE, reason="approved")


def set_user_role(*, actor: User, user: User, role: str) -> User:
    """ADM-04: promote/demote. Django admin access (is_staff/is_superuser) follows the role."""
    if role not in UserRole.values:
        raise ValidationError(fields={"role": ["Unknown role."]})
    if user.pk == actor.pk:
        raise BusinessRuleViolation("You cannot change your own role.")
    if user.role == role:
        return user
    if user.role == UserRole.SUPER_ADMIN and role == UserRole.MEMBER:
        raise BusinessRuleViolation("Super Admin accounts cannot be changed to member.")
    if (
        user.role == UserRole.SUPER_ADMIN
        and user.status == UserStatus.ACTIVE
        and _active_super_admin_count() <= 1
    ):
        raise BusinessRuleViolation("The last active Super Admin cannot be demoted.")
    before = user.role
    user.role = role
    user.is_staff = user.is_superuser = role == UserRole.SUPER_ADMIN
    user.save(update_fields=["role", "is_staff", "is_superuser", "updated_at"])
    publish(
        events.UserRoleChanged(
            actor_id=actor.pk, target_id=user.pk, changes=(("role", before, role),)
        )
    )
    return user


def send_password_reset(*, actor: User, user: User) -> None:
    """AUTH-05 "reset access": the Super Admin sends the normal reset email (ACTIVE users only)."""
    if user.status != UserStatus.ACTIVE:
        raise BusinessRuleViolation("Only active accounts can receive a password reset email.")
    request_password_reset(email=user.email)
