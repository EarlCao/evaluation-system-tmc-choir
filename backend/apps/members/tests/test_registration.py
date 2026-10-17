"""AUTH-01 registration use-case (members.services.register_member) and its API."""

import pytest
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
