"""Public write API of the accounts module."""

import hashlib
import hmac

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status as http_status

from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, DomainError, ValidationError
from apps.system.constants import RegistrationMode
from apps.system.selectors import get_settings

from . import emails, events
from .constants import INVALID_CREDENTIALS_MESSAGE, INVALID_LINK_MESSAGE, UserRole, UserStatus
from .models import User
from .tokens import decode_uid, email_verification_token, password_reset_token

EDITABLE_PROFILE_FIELDS = ("first_name", "last_name", "display_name")


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


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
def create_user(
    *, email: str, username: str, password: str, first_name: str, last_name: str
) -> User:
    """AUTH-01 / AUTH-03: create a member account. The initial status depends on
    ``registration_mode``: OPEN → ACTIVE, APPROVAL / EMAIL_VERIFICATION → PENDING,
    CLOSED → refused. Called by ``members.services.register_member`` (ADR-004)."""
    mode = get_settings().registration_mode
    if mode == RegistrationMode.CLOSED:
        raise BusinessRuleViolation("Registration is currently closed.")

    email = User.objects.normalize_email(email).strip().lower()
    username = User.normalize_username(username.strip())
    errors: dict[str, list[str]] = {}
    if User.objects.filter(email__iexact=email).exists():
        errors["email"] = ["An account with this email already exists."]
    if User.objects.filter(username__iexact=username).exists():
        errors["username"] = ["This username is already taken."]
    if errors:
        raise ValidationError(fields=errors)

    candidate = User(email=email, username=username, first_name=first_name, last_name=last_name)
    _check_password_strength(password, candidate)

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
def authenticate_and_login(*, request, identifier: str, password: str) -> User:
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


def confirm_password_reset(*, uidb64: str, token: str, new_password: str) -> User:
    user = _user_from_link(uidb64, token, password_reset_token)
    if user.status != UserStatus.ACTIVE:
        raise ValidationError(INVALID_LINK_MESSAGE, fields={"token": [INVALID_LINK_MESSAGE]})
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError(fields={"new_password": exc.messages}) from exc
    user.set_password(new_password)  # also invalidates the token and all existing sessions
    user.save(update_fields=["password", "updated_at"])
    publish(events.PasswordResetCompleted(actor_id=user.pk, target_id=user.pk))
    return user


# ---------------------------------------------------------------------------
# Email verification & profile
# ---------------------------------------------------------------------------
def verify_email(*, uidb64: str, token: str) -> User:
    """AUTH-03 (EMAIL_VERIFICATION mode): confirms the address and activates a PENDING
    account. The link stops working once used."""
    user = _user_from_link(uidb64, token, email_verification_token)
    user.email_verified_at = timezone.now()
    if user.status == UserStatus.PENDING:
        user.status = UserStatus.ACTIVE
    user.save(update_fields=["email_verified_at", "status", "updated_at"])
    publish(events.EmailVerified(actor_id=user.pk, target_id=user.pk))
    return user


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
