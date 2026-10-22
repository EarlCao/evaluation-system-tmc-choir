"""AUTH-01 registration use-case (members.services.register_member) and its API."""

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.constants import UserStatus
from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.core.exceptions import ValidationError
from apps.members import services
from apps.members.models import MemberProfile, VoiceSection
from apps.members.tests.factories import voice_section

pytestmark = pytest.mark.django_db

REGISTER_URL = reverse("members:register")
SECTIONS_URL = reverse("members:voice-sections")


def payload(**overrides):
    data = {
        "email": "bass.q1@example.org",
        "username": "bass_q1",
        "password": "Deep-Low-Notes-2026",
        "first_name": "Basso",
        "last_name": "Profundo",
        "voice_section": voice_section("Bass").pk,
    }
    data.update(overrides)
    return data


def csrf_client() -> APIClient:
    client = APIClient(enforce_csrf_checks=True)
    token = client.get(reverse("accounts:csrf")).cookies["csrftoken"].value
    client.credentials(HTTP_X_CSRFTOKEN=token)
    return client


def test_voice_sections_are_seeded():
    assert list(VoiceSection.objects.values_list("name", flat=True)) == [
        "Soprano",
        "Alto",
        "Tenor",
        "Bass",
    ]


def test_register_member_creates_user_and_profile():
    data = payload()
    section = data.pop("voice_section")
    user = services.register_member(voice_section_id=section, **data)
    assert user.member_profile.voice_section.name == "Bass"


def test_invalid_voice_section_creates_nothing():
    data = payload()
    data.pop("voice_section")
    with pytest.raises(ValidationError) as exc:
        services.register_member(voice_section_id=999, **data)
    assert "voice_section" in exc.value.fields
    assert not User.objects.filter(username="bass_q1").exists()


def test_inactive_voice_section_is_rejected():
    section = voice_section("Alto")
    section.is_active = False
    section.save()
    data = payload()
    data.pop("voice_section")
    with pytest.raises(ValidationError):
        services.register_member(voice_section_id=section.pk, **data)


def test_profile_failure_rolls_back_the_account(monkeypatch):
    def boom(**kwargs):
        raise RuntimeError("profile write failed")

    monkeypatch.setattr(MemberProfile.objects, "create", boom)
    data = payload()
    section = data.pop("voice_section")
    with pytest.raises(RuntimeError):
        services.register_member(voice_section_id=section, **data)
    assert not User.objects.filter(username="bass_q1").exists()


# --------------------------------------------------------------------------- API
def test_voice_sections_endpoint_is_public(api_client):
    response = api_client.get(SECTIONS_URL)
    assert response.status_code == 200
    assert [s["name"] for s in response.json()] == ["Soprano", "Alto", "Tenor", "Bass"]


@pytest.mark.parametrize(
    ("mode", "status", "phrase"),
    [
        ("APPROVAL", UserStatus.PENDING, "waiting for Super Admin approval"),
        ("EMAIL_VERIFICATION", UserStatus.PENDING, "Check your email"),
        ("OPEN", UserStatus.ACTIVE, "You can now log in"),
    ],
)
def test_register_api_per_mode(
    registration_mode, mode, status, phrase, django_capture_on_commit_callbacks
):
    registration_mode(mode)
    with django_capture_on_commit_callbacks(execute=True):
        response = csrf_client().post(REGISTER_URL, payload())
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == status
    assert phrase in body["detail"]
    assert "password" not in response.content.decode()
    assert AuditLog.objects.filter(event_type="accounts.user.registered").exists()


def test_register_api_closed(registration_mode):
    registration_mode("CLOSED")
    response = csrf_client().post(REGISTER_URL, payload())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "business_rule_violation"


def test_register_api_validation_errors_use_fields():
    response = csrf_client().post(REGISTER_URL, payload(email="not-an-email", password="short"))
    assert response.status_code == 400
    assert "email" in response.json()["error"]["fields"]


def test_register_api_requires_csrf():
    response = APIClient(enforce_csrf_checks=True).post(REGISTER_URL, payload())
    assert response.status_code == 403


def test_register_api_is_throttled():
    client = csrf_client()
    codes = [
        client.post(
            REGISTER_URL, payload(email=f"s{i}@example.org", username=f"s_q{i}")
        ).status_code
        for i in range(4)
    ]
    assert codes == [201, 201, 201, 429]


def test_failed_email_delivery_does_not_use_hourly_registration_allowance(monkeypatch):
    from apps.accounts import emails

    client = csrf_client()
    data = payload()

    def unavailable(*args, **kwargs):
        raise OSError("provider unavailable")

    with monkeypatch.context() as context:
        context.setattr(emails, "send_mail", unavailable)
        responses = [
            client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1") for _ in range(4)
        ]
    assert [r.status_code for r in responses] == [503] * 4
    assert not User.objects.filter(email=data["email"]).exists()
    assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 201


def test_provider_outage_retries_still_have_a_short_rate_limit(monkeypatch):
    from apps.accounts import emails

    def unavailable(*args, **kwargs):
        raise OSError("provider unavailable")

    monkeypatch.setattr(emails, "send_mail", unavailable)
    client = csrf_client()
    data = payload()
    codes = [
        client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code
        for _ in range(11)
    ]
    assert codes == [503] * 10 + [429]


def test_failed_delivery_preserves_previous_successful_request_allowance(monkeypatch):
    from apps.accounts import emails

    client = csrf_client()
    data = payload()
    for _ in range(2):
        assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 201

    def unavailable(*args, **kwargs):
        raise OSError("provider unavailable")

    with monkeypatch.context() as context:
        context.setattr(emails, "send_mail", unavailable)
        assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 503
    assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 201
    assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 429


def test_old_failed_delivery_lockout_is_not_reused():
    import time

    cache.set("throttle_register_127.0.0.1", [time.time()] * 3, 3600)
    client = csrf_client()
    response = client.post(REGISTER_URL, payload(), HTTP_X_DEFER_ACCOUNT_CREATION="1")
    assert response.status_code == 201


def test_burst_rejections_do_not_spend_hourly_allowance():
    import time

    burst_key = "throttle_register_attempt_127.0.0.1"
    cache.set(burst_key, [time.time()] * 10, 60)
    client = csrf_client()
    data = payload()
    for _ in range(4):
        assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 429
    cache.delete(burst_key)
    assert client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1").status_code == 201


def test_deferred_registration_only_creates_account_after_otp_verification(
    django_capture_on_commit_callbacks,
):
    import re

    from django.core import mail

    client = csrf_client()
    data = payload(email="deferred@example.org", username="deferred_user")

    # First attempt without verifying OTP: account must NOT exist in DB yet.
    first = client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1")
    assert first.status_code == 201
    assert not User.objects.filter(username="deferred_user").exists()

    # Second attempt with the exact same username and email must succeed without "already taken".
    second = client.post(REGISTER_URL, data, HTTP_X_DEFER_ACCOUNT_CREATION="1")
    assert second.status_code == 201
    assert not User.objects.filter(username="deferred_user").exists()

    otp_match = re.search(r"Your 6-digit OTP verification code is:\s*(\d{6})", mail.outbox[-1].body)
    assert otp_match is not None
    otp = otp_match.group(1)

    with django_capture_on_commit_callbacks(execute=True):
        verify = client.post(
            reverse("accounts:verify-email"),
            {"email": "deferred@example.org", "otp": otp},
        )
    assert verify.status_code == 200
    created_user = User.objects.get(username="deferred_user")
    assert created_user.email_verified_at is not None
    assert created_user.member_profile.voice_section.name == "Bass"
