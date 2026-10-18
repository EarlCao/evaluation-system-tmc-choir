import re

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.core import mail
from django.test import RequestFactory

from apps.accounts import services
from apps.accounts.constants import UserRole, UserStatus
from apps.accounts.models import User
from apps.accounts.tests.factories import DEFAULT_PASSWORD, SuperAdminFactory, UserFactory
from apps.accounts.tokens import email_verification_token, encode_uid, password_reset_token
from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation, ValidationError

pytestmark = pytest.mark.django_db

NEW_PASSWORD = "Brand-New-Chorus-77"


def register(**overrides):
    data = {
        "email": "new.singer@example.org",
        "username": "new_singer_q1",
        "password": "Sing-Loud-And-Clear-1",  # gitleaks:allow (fake test password)
        "first_name": "Nova",
        "last_name": "Singer",
    }
    data.update(overrides)
    return services.create_user(**data)


def http_request():
    request = RequestFactory().post("/")
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    request.user = AnonymousUser()  # as AuthenticationMiddleware would set
    return request


# --------------------------------------------------------------------------- registration
@pytest.mark.parametrize(
    ("mode", "status"),
    [
        ("OPEN", UserStatus.ACTIVE),
        ("APPROVAL", UserStatus.PENDING),
        ("EMAIL_VERIFICATION", UserStatus.PENDING),
    ],
)
def test_registration_status_depends_on_mode(
    registration_mode, mode, status, django_capture_on_commit_callbacks
):
    """AUTH-03"""
    registration_mode(mode)
    with django_capture_on_commit_callbacks(execute=True):
        user = register()
    assert user.status == status
    assert user.role == UserRole.MEMBER


def test_closed_registration_is_refused(registration_mode):
    registration_mode("CLOSED")
    with pytest.raises(BusinessRuleViolation):
        register()
    assert not User.objects.filter(username="new_singer_q1").exists()


def test_email_verification_mode_sends_link(
    registration_mode, settings, django_capture_on_commit_callbacks
):
    registration_mode("EMAIL_VERIFICATION")
    settings.FRONTEND_URL = "https://choir.example.org"
    with django_capture_on_commit_callbacks(execute=True):
        user = register()
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user.email]
    assert f"https://choir.example.org/verify-email/{encode_uid(user)}/" in mail.outbox[0].body


def test_approval_mode_sends_no_email(registration_mode, django_capture_on_commit_callbacks):
    registration_mode("APPROVAL")
    with django_capture_on_commit_callbacks(execute=True):
        register()
    assert mail.outbox == []


def test_duplicate_email_and_username_are_rejected_case_insensitively():
    UserFactory(username="Taken_Q1", email="taken.q1@example.org")
    with pytest.raises(ValidationError) as exc:
        register(username="taken_q1", email="TAKEN.Q1@example.org")
    assert set(exc.value.fields) == {"email", "username"}


@pytest.mark.parametrize("password", ["short1!", "password1234", "12345678901", "new_singer_q1"])
def test_weak_passwords_are_rejected(password):
    with pytest.raises(ValidationError) as exc:
        register(password=password)
    assert "password" in exc.value.fields


def test_registration_is_audited_without_personal_data(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        user = register()
    entry = AuditLog.objects.get(event_type="accounts.user.registered")
    assert (entry.target_type, entry.target_id) == ("accounts.User", str(user.pk))
    assert entry.metadata == {"status": "PENDING", "registration_mode": "APPROVAL"}
    assert "new.singer@example.org" not in str(entry.metadata)


# --------------------------------------------------------------------------- login / logout
def test_login_success_sets_session_and_audits(django_capture_on_commit_callbacks):
    user = UserFactory()
    request = http_request()
    with django_capture_on_commit_callbacks(execute=True):
        result = services.authenticate_and_login(
            request=request, identifier=user.email, password=DEFAULT_PASSWORD
        )
    assert result == user
    assert request.session["_auth_user_id"] == str(user.pk)
    assert AuditLog.objects.filter(event_type="accounts.user.logged_in", actor=user).exists()


@pytest.mark.parametrize(
    "case", ["wrong_password", "unknown_user", "pending", "suspended", "deactivated"]
)
def test_every_login_failure_is_the_same_generic_error(case, django_capture_on_commit_callbacks):
    """Security Model: no account enumeration, no status disclosure."""
    user = UserFactory(**({case: True} if case in {"pending", "suspended", "deactivated"} else {}))
    identifier = "ghost_q1" if case == "unknown_user" else user.username
    password = "wrong-password-9" if case == "wrong_password" else DEFAULT_PASSWORD

    with (
        django_capture_on_commit_callbacks(execute=True),
        pytest.raises(services.InvalidCredentials) as exc,
    ):
        services.authenticate_and_login(
            request=http_request(), identifier=identifier, password=password
        )
    assert exc.value.message == "Invalid credentials or account not active."
    assert exc.value.code == "invalid_credentials"

    entry = AuditLog.objects.get(event_type="accounts.user.login_failed")
    assert entry.metadata["identifier_hash"] == services.identifier_hash(identifier)
    assert identifier not in str(entry.metadata)  # raw identifier never stored


def test_logout_flushes_session_and_audits(django_capture_on_commit_callbacks):
    user = UserFactory()
    request = http_request()
    services.authenticate_and_login(
        request=request, identifier=user.username, password=DEFAULT_PASSWORD
    )
    with django_capture_on_commit_callbacks(execute=True):
        services.logout(request=request)
    assert "_auth_user_id" not in request.session
    assert AuditLog.objects.filter(event_type="accounts.user.logged_out", actor=user).exists()


# --------------------------------------------------------------------------- passwords
def test_change_password_requires_current_password():
    user = UserFactory()
    with pytest.raises(ValidationError) as exc:
        services.change_password(
            request=http_request(), user=user, old_password="nope-nope-1", new_password=NEW_PASSWORD
        )
    assert "old_password" in exc.value.fields


def test_change_password_validates_strength():
    user = UserFactory()
    with pytest.raises(ValidationError) as exc:
        services.change_password(
            request=http_request(), user=user, old_password=DEFAULT_PASSWORD, new_password="123"
        )
    assert "new_password" in exc.value.fields


def test_change_password_success(django_capture_on_commit_callbacks):
    user = UserFactory()
    request = http_request()
    request.user = user
    with django_capture_on_commit_callbacks(execute=True):
        services.change_password(
            request=request, user=user, old_password=DEFAULT_PASSWORD, new_password=NEW_PASSWORD
        )
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert AuditLog.objects.filter(event_type="accounts.password.changed").exists()


def _reset_link_parts():
    match = re.search(r"/reset-password/([^/]+)/([^/\s]+)", mail.outbox[-1].body)
    return match.group(1), match.group(2)


def test_password_reset_flow(django_capture_on_commit_callbacks):
    user = UserFactory(email="reset.q1@example.org")
    with django_capture_on_commit_callbacks(execute=True):
        services.request_password_reset(email="RESET.Q1@example.org")
    assert len(mail.outbox) == 1
    uid, token = _reset_link_parts()

    services.confirm_password_reset(uidb64=uid, token=token, new_password=NEW_PASSWORD)
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)

    with pytest.raises(ValidationError):  # the link works only once
        services.confirm_password_reset(uidb64=uid, token=token, new_password="Another-Pass-88")


@pytest.mark.parametrize("trait", [None, "pending", "suspended"])
def test_password_reset_request_never_reveals_anything(trait, django_capture_on_commit_callbacks):
    if trait:
        UserFactory(email="someone.q1@example.org", **{trait: True})
    email = "someone.q1@example.org" if trait else "unknown.q1@example.org"
    with django_capture_on_commit_callbacks(execute=True):
        assert services.request_password_reset(email=email) is None
    assert mail.outbox == []  # only ACTIVE users get an email
    assert AuditLog.objects.filter(event_type="accounts.password.reset_requested").exists()


@pytest.mark.parametrize(("uid", "token"), [("bad", "bad"), ("MQ", "1-abc")])
def test_invalid_reset_links_are_rejected(uid, token):
    with pytest.raises(ValidationError) as exc:
        services.confirm_password_reset(uidb64=uid, token=token, new_password=NEW_PASSWORD)
    assert "token" in exc.value.fields


def test_reset_rejects_weak_password():
    user = UserFactory()
    with pytest.raises(ValidationError) as exc:
        services.confirm_password_reset(
            uidb64=encode_uid(user), token=password_reset_token.make_token(user), new_password="abc"
        )
    assert "new_password" in exc.value.fields


# --------------------------------------------------------------------------- email verification
def test_verify_email_activates_pending_user_once():
    user = UserFactory(pending=True)
    uid, token = encode_uid(user), email_verification_token.make_token(user)

    services.verify_email(uidb64=uid, token=token)
    user.refresh_from_db()
    assert user.status == UserStatus.ACTIVE
    assert user.email_verified_at is not None

    with pytest.raises(ValidationError):
        services.verify_email(uidb64=uid, token=token)


def test_password_reset_token_is_not_a_verification_token():
    user = UserFactory(pending=True)
    with pytest.raises(ValidationError):
        services.verify_email(uidb64=encode_uid(user), token=password_reset_token.make_token(user))


@pytest.mark.parametrize("bad_username", ["NovaSinger", "nova.singer", "nova-singer", "nova@1"])
def test_username_must_be_lowercase_letters_numbers_or_underscore(bad_username):
    with pytest.raises(ValidationError) as exc:
        register(username=bad_username)
    assert "username" in exc.value.fields


def test_verify_email_with_otp(registration_mode, django_capture_on_commit_callbacks):
    registration_mode("EMAIL_VERIFICATION")
    with django_capture_on_commit_callbacks(execute=True):
        user = register(email="otp.verify@example.org", username="otp_verify_1")
    otp_match = re.search(r"Your 6-digit OTP verification code is:\s*(\d{6})", mail.outbox[-1].body)
    assert otp_match is not None
    otp = otp_match.group(1)

    services.verify_email(email=user.email, otp=otp)
    user.refresh_from_db()
    assert user.status == UserStatus.ACTIVE
    assert user.email_verified_at is not None

    with pytest.raises(ValidationError) as exc:
        services.verify_email(email=user.email, otp=otp)
    assert "otp" in exc.value.fields


def test_password_reset_with_otp(django_capture_on_commit_callbacks):
    user = UserFactory(email="otp.reset@example.org")
    with django_capture_on_commit_callbacks(execute=True):
        services.request_password_reset(email=user.email)
    otp_match = re.search(r"Your 6-digit OTP password reset code is:\s*(\d{6})", mail.outbox[-1].body)
    assert otp_match is not None
    otp = otp_match.group(1)

    services.confirm_password_reset(email=user.email, otp=otp, new_password=NEW_PASSWORD)
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)

    with pytest.raises(ValidationError) as exc:
        services.confirm_password_reset(
            email=user.email, otp=otp, new_password="Another-Chorus-Pass-99"
        )
    assert "otp" in exc.value.fields


# --------------------------------------------------------------------------- profile
def test_update_own_profile_changes_names_only(django_capture_on_commit_callbacks):
    user = UserFactory()
    with django_capture_on_commit_callbacks(execute=True):
        services.update_own_profile(user=user, first_name="Lia ", display_name="Lili")
    user.refresh_from_db()
    assert (user.first_name, user.display_name) == ("Lia", "Lili")
    entry = AuditLog.objects.get(event_type="accounts.user.profile_updated")
    assert entry.metadata == {"changed_fields": ["first_name", "display_name"]}

    with pytest.raises(ValidationError):
        services.update_own_profile(user=user, role=UserRole.SUPER_ADMIN)


def test_profile_requires_names():
    with pytest.raises(ValidationError):
        services.update_own_profile(user=UserFactory(), last_name="  ")


# --------------------------------------------------------------------------- admin operations
def test_approve_pending_user(django_capture_on_commit_callbacks):
    admin = SuperAdminFactory()
    user = UserFactory(pending=True)
    with django_capture_on_commit_callbacks(execute=True):
        services.approve_user(actor=admin, user=user)
    user.refresh_from_db()
    assert user.status == UserStatus.ACTIVE
    assert user.approved_by == admin
    assert user.approved_at is not None
    entry = AuditLog.objects.get(event_type="accounts.user.status_changed")
    assert entry.actor == admin
    assert (entry.before, entry.after) == ({"status": "PENDING"}, {"status": "ACTIVE"})


def test_only_pending_users_can_be_approved():
    with pytest.raises(BusinessRuleViolation):
        services.approve_user(actor=SuperAdminFactory(), user=UserFactory())


def test_suspension_takes_effect_and_is_audited(django_capture_on_commit_callbacks):
    admin, user = SuperAdminFactory(), UserFactory()
    with django_capture_on_commit_callbacks(execute=True):
        services.set_user_status(
            actor=admin, user=user, status=UserStatus.SUSPENDED, reason="policy"
        )
    user.refresh_from_db()
    assert user.status == UserStatus.SUSPENDED
    assert not user.is_active
    assert AuditLog.objects.get(event_type="accounts.user.status_changed").metadata == {
        "reason": "policy"
    }


def test_cannot_change_own_status():
    admin = SuperAdminFactory()
    with pytest.raises(BusinessRuleViolation):
        services.set_user_status(actor=admin, user=admin, status=UserStatus.SUSPENDED)


def test_last_active_super_admin_cannot_be_deactivated():
    only_admin = SuperAdminFactory()
    other = SuperAdminFactory(status=UserStatus.SUSPENDED)  # not active, cannot count
    with pytest.raises(BusinessRuleViolation):
        services.set_user_status(actor=other, user=only_admin, status=UserStatus.DEACTIVATED)

    second = SuperAdminFactory()
    services.set_user_status(actor=second, user=only_admin, status=UserStatus.DEACTIVATED)
    only_admin.refresh_from_db()
    assert only_admin.status == UserStatus.DEACTIVATED


def test_create_super_admin(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        admin = services.create_super_admin(
            email="boss@example.org",
            username="boss_q1",
            password="Conductor-Baton-42",  # gitleaks:allow (fake test password)
            first_name="B",
            last_name="Q",
        )
    assert admin.is_super_admin
    assert admin.is_staff
    assert admin.email_verified_at
    assert AuditLog.objects.filter(event_type="accounts.user.super_admin_created").exists()
