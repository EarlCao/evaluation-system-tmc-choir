"""AUTH-01/03: deployed registration must preserve accounts and approval policy."""

from unittest.mock import patch

import pytest
from django.core import mail
from django.core.cache import cache

from apps.accounts import services
from apps.accounts.constants import UserStatus
from apps.accounts.models import User
from apps.accounts.tokens import make_pending_registration_otp
from apps.core.exceptions import DomainError, ValidationError
from apps.members import services as member_services
from apps.members.tests.factories import MemberProfileFactory, voice_section

pytestmark = pytest.mark.django_db


def stage(**changes):
    data = {
        "email": "new.singer@example.org",
        "username": "new_singer",
        "password": "New-Singer-Passphrase-2026",
        "first_name": "Nova",
        "last_name": "Singer",
        "voice_section_id": voice_section("Alto").pk,
    }
    data.update(changes)
    member_services.stage_member_registration(**data)
    record = cache.get(services.pending_registration_key(data["email"]))
    return data, record


def code(data, record):
    return make_pending_registration_otp(data["email"], data["username"], nonce=record["nonce"])


def test_pending_password_is_hashed_and_cache_expiration_is_authoritative():
    data, record = stage()
    assert "password" not in record
    assert data["password"] not in str(record)
    assert not User.objects.filter(email=data["email"]).exists()
    cache.delete(services.pending_registration_key(data["email"]))
    with pytest.raises(ValidationError):
        services.verify_email(email=data["email"], otp=code(data, record))
    assert not User.objects.filter(email=data["email"]).exists()


@pytest.mark.parametrize("mode", ["OPEN", "APPROVAL", "EMAIL_VERIFICATION"])
def test_verified_registration_respects_approval_and_password(mode, registration_mode):
    registration_mode(mode)
    data, record = stage()
    user = services.verify_email(email=data["email"], otp=code(data, record))
    assert user.check_password(data["password"])
    assert user.email_verified_at is not None
    assert user.status == (UserStatus.PENDING if mode == "APPROVAL" else UserStatus.ACTIVE)
    assert user.member_profile.voice_section.name == "Alto"
    assert cache.get(services.pending_registration_key(data["email"])) is None
    with pytest.raises(ValidationError):
        services.verify_email(email=data["email"], otp=code(data, record))


def test_repeated_registration_does_not_destroy_existing_pending_account():
    original = MemberProfileFactory(user__status=UserStatus.PENDING).user
    original_password = original.password
    with pytest.raises(ValidationError):
        stage(email=original.email, username=original.username)
    original.refresh_from_db()
    assert original.password == original_password
    assert original.status == UserStatus.PENDING
    assert original.member_profile is not None


def test_resending_replaces_the_challenge():
    data, old = stage()
    _, new = stage()
    assert old["nonce"] != new["nonce"]
    assert code(data, old) != code(data, new)


def test_approval_email_confirmation_does_not_activate_existing_account(registration_mode):
    registration_mode("APPROVAL")
    user = MemberProfileFactory(user__status=UserStatus.PENDING).user
    from apps.accounts.tokens import make_email_otp

    services.verify_email(email=user.email, otp=make_email_otp(user))
    user.refresh_from_db()
    assert user.status == UserStatus.PENDING
    assert user.email_verified_at is not None


def test_challenge_has_an_attempt_budget_across_clients():
    data, record = stage()
    valid = code(data, record)
    wrong = "000000" if valid != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(ValidationError):
            services.verify_email(email=data["email"], otp=wrong)
    with pytest.raises(ValidationError):
        services.verify_email(email=data["email"], otp=valid)


def test_smtp_failure_is_reported_without_console_token_fallback(caplog):
    from apps.accounts.emails import send_pending_registration_otp_email

    with (
        patch("apps.accounts.emails.send_mail", side_effect=OSError("SMTP unavailable")),
        pytest.raises(DomainError) as error,
    ):
        send_pending_registration_otp_email(
            email="private@example.org", username="private", first_name="P"
        )
    assert error.value.status_code == 503
    assert "private@example.org" not in caplog.text
    assert mail.outbox == []


def test_reset_response_stays_generic_when_delivery_fails(
    api_client, member, django_capture_on_commit_callbacks
):
    from django.urls import reverse

    url = reverse("accounts:password-reset")
    with (
        patch("apps.accounts.emails.send_mail", side_effect=OSError("SMTP unavailable")),
        django_capture_on_commit_callbacks(execute=True),
    ):
        known = api_client.post(url, {"email": member.email})
        unknown = api_client.post(url, {"email": "unknown@example.org"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
