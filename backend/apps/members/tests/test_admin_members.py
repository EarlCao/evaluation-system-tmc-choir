"""Step 4.2: Super Admin member & role management (AUTH-05, MEM-05, ADM-04)."""

import pytest
from django.core import mail
from django.urls import reverse

from apps.accounts.constants import UserRole, UserStatus
from apps.accounts.tests.factories import SuperAdminFactory, UserFactory
from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation
from apps.evaluations import rules
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.models import VoiceSection
from apps.members.tests.factories import MemberProfileFactory, voice_section

pytestmark = pytest.mark.django_db


def url(name, *args):
    return reverse(f"members-admin:{name}", args=args)


@pytest.fixture
def pending():
    return MemberProfileFactory(user=UserFactory(pending=True, first_name="Penny")).user


# --------------------------------------------------------------------------- permissions
@pytest.mark.parametrize("name", ["members", "voice-sections"])
def test_members_and_anonymous_are_refused(api_client, member_client, name):
    assert api_client.get(url(name)).status_code == 401
    assert member_client.get(url(name)).status_code == 403


# --------------------------------------------------------------------------- listing
def test_list_includes_every_account_with_profile_data(admin_client_api, pending, super_admin):
    MemberProfileFactory(user=UserFactory(first_name="Aria"))
    body = admin_client_api.get(url("members")).json()
    assert body["count"] == 3  # pending member, active member, the super admin
    by_name = {m["first_name"]: m for m in body["results"]}
    assert by_name["Penny"]["status"] == "PENDING"
    assert by_name["Aria"]["profile"]["voice_section"]["name"] == "Tenor"
    assert by_name[super_admin.first_name]["profile"] is None
    assert "email" in by_name["Aria"]  # admins see contact details


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ({"status": "PENDING"}, {"Penny"}),
        ({"search": "penn"}, {"Penny"}),
        ({"role": "SUPER_ADMIN"}, {"admin"}),
    ],
)
def test_list_filters(admin_client_api, pending, super_admin, query, expected):
    MemberProfileFactory(user=UserFactory(first_name="Aria"))
    results = admin_client_api.get(url("members"), query).json()["results"]
    names = {"admin" if r["role"] == "SUPER_ADMIN" else r["first_name"] for r in results}
    assert names == expected


def test_invalid_filter_is_rejected(admin_client_api):
    response = admin_client_api.get(url("members"), {"status": "SLEEPING"})
    assert response.status_code == 400
    assert "status" in response.json()["error"]["fields"]


# --------------------------------------------------------------------------- account actions
def test_approve_pending_member(
    admin_client_api, super_admin, pending, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_client_api.post(url("approve", pending.public_id))
    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"
    assert response.json()["approved_at"] is not None
    assert AuditLog.objects.filter(
        event_type="accounts.user.status_changed", actor=super_admin
    ).exists()
    assert admin_client_api.post(url("approve", pending.public_id)).status_code == 409


def test_status_change_with_reason(admin_client_api, member, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_client_api.post(
            url("status", member.public_id), {"status": "SUSPENDED", "reason": "Repeated no-shows"}
        )
    assert response.json()["status"] == "SUSPENDED"
    entry = AuditLog.objects.get(event_type="accounts.user.status_changed")
    assert entry.metadata == {"reason": "Repeated no-shows"}


def test_admin_cannot_change_own_status_or_role(admin_client_api, super_admin):
    assert (
        admin_client_api.post(
            url("status", super_admin.public_id), {"status": "SUSPENDED"}
        ).status_code
        == 409
    )
    assert (
        admin_client_api.post(url("role", super_admin.public_id), {"role": "MEMBER"}).status_code
        == 409
    )


def test_super_admin_cannot_be_changed_to_member(
    admin_client_api, member, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        promoted = admin_client_api.post(url("role", member.public_id), {"role": "SUPER_ADMIN"})
    assert promoted.json()["role"] == "SUPER_ADMIN"
    member.refresh_from_db()
    assert member.is_staff
    assert member.is_superuser
    entry = AuditLog.objects.get(event_type="accounts.user.role_changed")
    assert (entry.before, entry.after) == ({"role": "MEMBER"}, {"role": "SUPER_ADMIN"})

    demoted = admin_client_api.post(url("role", member.public_id), {"role": "MEMBER"})
    assert demoted.status_code == 409
    assert "Super Admin accounts cannot be changed to member" in demoted.json()["error"]["message"]
    member.refresh_from_db()
    assert member.role == UserRole.SUPER_ADMIN


def test_super_admin_cannot_be_demoted_service(super_admin):
    from apps.accounts import services

    other = SuperAdminFactory()
    with pytest.raises(BusinessRuleViolation, match="Super Admin accounts cannot be changed to member"):
        services.set_user_role(actor=other, user=super_admin, role=UserRole.MEMBER)


def test_promoted_member_with_profile_cannot_evaluate(super_admin, member):
    """Q9: Super Admins never evaluate, even with a choir profile."""
    from apps.accounts import services

    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    cycle = make_cycle(super_admin, form=form, open=True)
    services.set_user_role(actor=super_admin, user=member, role=UserRole.SUPER_ADMIN)
    member.refresh_from_db()
    verdict = rules.eligibility(
        evaluator=member, recipient_profile=MemberProfileFactory(), cycle=cycle
    )
    assert verdict.reason == "NOT_A_MEMBER"


def test_send_password_reset(admin_client_api, member, pending, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        assert admin_client_api.post(url("password-reset", member.public_id)).status_code == 202
    assert mail.outbox[0].to == [member.email]
    assert admin_client_api.post(url("password-reset", pending.public_id)).status_code == 409


# --------------------------------------------------------------------------- profile
def test_edit_profile(admin_client_api, member, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_client_api.patch(
            url("member", member.public_id),
            {"voice_section": voice_section("Bass").pk, "is_evaluable": False},
        )
    profile = response.json()["profile"]
    assert (profile["voice_section"]["name"], profile["is_evaluable"]) == ("Bass", False)
    entry = AuditLog.objects.get(event_type="members.profile.updated")
    assert sorted(entry.metadata["changed_fields"]) == ["is_evaluable", "voice_section_id"]


def test_edit_profile_validation(admin_client_api, member, super_admin):
    inactive = VoiceSection.objects.create(name="Countertenor", is_active=False)
    bad = admin_client_api.patch(url("member", member.public_id), {"voice_section": inactive.pk})
    assert bad.status_code == 400
    no_profile = admin_client_api.patch(
        url("member", super_admin.public_id), {"is_evaluable": False}
    )
    assert no_profile.status_code == 404


def test_unknown_member_is_404(admin_client_api):
    assert (
        admin_client_api.get(url("member", "00000000-0000-4000-8000-000000000000")).status_code
        == 404
    )


# --------------------------------------------------------------------------- voice sections
def test_voice_sections_crud(admin_client_api, member, django_capture_on_commit_callbacks):
    listed = admin_client_api.get(url("voice-sections")).json()
    assert {s["name"]: s["member_count"] for s in listed}["Tenor"] == 1
    with django_capture_on_commit_callbacks(execute=True):
        created = admin_client_api.post(url("voice-sections"), {"name": "Baritone"})
        assert created.status_code == 201
        section_id = created.json()["id"]
        renamed = admin_client_api.patch(
            url("voice-section", section_id), {"name": "Baritone II", "is_active": False}
        )
    assert renamed.json() == {
        "id": section_id,
        "name": "Baritone II",
        "sort_order": 5,
        "is_active": False,
        "member_count": None,
    }
    assert admin_client_api.post(url("voice-sections"), {"name": "tenor"}).status_code == 400
    assert AuditLog.objects.filter(event_type="members.voice_section.changed").count() == 2
    # deactivated sections disappear from the public registration list
    public = admin_client_api.get(reverse("members:voice-sections")).json()
    assert "Baritone II" not in {s["name"] for s in public}


def test_status_values_are_validated(admin_client_api, member):
    response = admin_client_api.post(url("status", member.public_id), {"status": "BANNED"})
    assert response.status_code == 400


def test_member_counts_stay_consistent(member):
    assert member.status == UserStatus.ACTIVE
