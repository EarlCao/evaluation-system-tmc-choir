"""MEM-01..03 directory, member detail and own profile."""

import pytest
from django.urls import reverse

from apps.accounts.tests.factories import SuperAdminFactory, UserFactory
from apps.audit.models import AuditLog
from apps.members.tests.factories import MemberProfileFactory, voice_section

pytestmark = pytest.mark.django_db

DIRECTORY = reverse("members:directory")
ME = reverse("members:me")
ENTRY_FIELDS = {
    "public_id",
    "first_name",
    "last_name",
    "display_name",
    "voice_section",
    "is_officer",
    "officer_position",
    "has_self_evaluation",
    "self_evaluation_summary",
    "is_evaluated",
    "evaluation_id",
}


def make_member(first, last, section="Tenor", **user_kwargs):
    return MemberProfileFactory(
        user=UserFactory(first_name=first, last_name=last, **user_kwargs),
        voice_section=voice_section(section),
    ).user


def names(response):
    return [f"{m['first_name']} {m['last_name']}" for m in response.json()["results"]]


def test_directory_requires_login(api_client):
    assert api_client.get(DIRECTORY).status_code == 401


def test_directory_lists_only_active_members_ordered_by_name(member_client, member):
    make_member("Zed", "Alto", "Alto")
    make_member("Ann", "Bass", "Bass")
    make_member("Pat", "Pending", pending=True)
    make_member("Sue", "Suspended", suspended=True)
    SuperAdminFactory(first_name="Root", last_name="Admin")  # no member profile

    response = member_client.get(DIRECTORY)
    assert response.status_code == 200
    listed = names(response)
    assert "Zed Alto" in listed
    assert "Ann Bass" in listed
    assert not any(n.startswith(("Pat", "Sue", "Root")) for n in listed)
    last_names = [m["last_name"] for m in response.json()["results"]]
    assert last_names == sorted(last_names)


def test_directory_entries_expose_basic_fields_only(member_client):
    """Privacy: no email, username, status or account details in the directory."""
    make_member("Ana", "Reyes", email="ana.reyes.secret@example.org", username="ana_secret_q")
    payload = member_client.get(DIRECTORY).json()
    assert all(set(entry) == ENTRY_FIELDS for entry in payload["results"])
    blob = str(payload)
    assert "ana.reyes.secret@example.org" not in blob
    assert "ana_secret_q" not in blob


@pytest.mark.parametrize(("query", "expected"), [("ann", ["Ann Bass"]), ("BASS ann", ["Ann Bass"])])
def test_search_by_name(member_client, query, expected):
    make_member("Ann", "Bass", "Bass")
    make_member("Zed", "Alto", "Alto")
    assert names(member_client.get(DIRECTORY, {"search": query})) == expected


def test_filter_by_voice_section(member_client):
    make_member("Ann", "Bass", "Bass")
    make_member("Zed", "Alto", "Alto")
    response = member_client.get(DIRECTORY, {"voice_section": voice_section("Alto").pk})
    assert names(response) == ["Zed Alto"]


def test_invalid_voice_section_filter_is_a_validation_error(member_client):
    response = member_client.get(DIRECTORY, {"voice_section": 9999})
    assert response.status_code == 400
    assert "voice_section" in response.json()["error"]["fields"]


def test_directory_is_paginated(member_client):
    for i in range(25):
        make_member(f"First{i:02d}", f"Last{i:02d}")
    page1 = member_client.get(DIRECTORY).json()
    assert page1["count"] == 26  # 25 + the logged-in member
    assert len(page1["results"]) == 20
    assert page1["next"] is not None


def test_directory_query_count_does_not_grow_with_members(
    member_client, django_assert_max_num_queries
):
    for i in range(15):
        make_member(f"First{i:02d}", f"Last{i:02d}")
    with django_assert_max_num_queries(6):  # session + user + count + page (no N+1)
        assert member_client.get(DIRECTORY).status_code == 200


def test_member_detail(member_client, member):
    other = MemberProfileFactory(bio="Loves Bach").user
    response = member_client.get(reverse("members:detail", args=[other.public_id]))
    assert response.status_code == 200
    body = response.json()
    assert body["bio"] == "Loves Bach"
    assert body["is_self"] is False
    assert other.email not in str(body)

    own = member_client.get(reverse("members:detail", args=[member.public_id])).json()
    assert own["is_self"] is True


@pytest.mark.parametrize("trait", ["pending", "suspended", "deactivated"])
def test_inactive_member_detail_is_not_found(member_client, trait):
    hidden = MemberProfileFactory(user=UserFactory(**{trait: True})).user
    response = member_client.get(reverse("members:detail", args=[hidden.public_id]))
    assert response.status_code == 404


def test_unknown_member_is_not_found(member_client):
    url = reverse("members:detail", args=["00000000-0000-4000-8000-000000000000"])
    assert member_client.get(url).status_code == 404


def test_own_profile_get_and_update_bio(member_client, django_capture_on_commit_callbacks):
    assert member_client.get(ME).json()["voice_section"]["name"] == "Tenor"
    with django_capture_on_commit_callbacks(execute=True):
        response = member_client.patch(ME, {"bio": "  Second tenor since 2019  "})
    assert response.status_code == 200
    assert response.json()["bio"] == "Second tenor since 2019"
    assert AuditLog.objects.filter(event_type="members.profile.updated").exists()


def test_own_profile_bio_length_is_limited(member_client):
    response = member_client.patch(ME, {"bio": "x" * 501})
    assert response.status_code == 400
    assert "bio" in response.json()["error"]["fields"]


def test_super_admin_without_profile_gets_404_for_own_profile(admin_client_api):
    assert admin_client_api.get(ME).status_code == 404


def test_directory_marks_already_evaluated_members_for_viewer(member_client, member):
    target = make_member("Jane", "Doe")
    not_evaluated = make_member("John", "Smith")
    from django.utils import timezone
    from apps.evaluations.models import Evaluation
    from apps.evaluations.tests.factories import make_cycle

    cycle = make_cycle(open=True)
    evaluation = Evaluation.objects.create(
        evaluator=member,
        recipient=target,
        cycle=cycle,
        form_version=cycle.form_version,
        status="SUBMITTED",
        submitted_at=timezone.now(),
    )

    response = member_client.get(DIRECTORY)
    assert response.status_code == 200
    results = {m["public_id"]: m for m in response.json()["results"]}
    assert results[str(target.public_id)]["is_evaluated"] is True
    assert results[str(target.public_id)]["evaluation_id"] == str(evaluation.public_id)
    assert results[str(not_evaluated.public_id)]["is_evaluated"] is False
    assert results[str(not_evaluated.public_id)]["evaluation_id"] is None


def test_directory_filter_by_evaluation_status(member_client, member):
    target = make_member("Jane", "Doe")
    not_evaluated = make_member("John", "Smith")
    from django.utils import timezone
    from apps.evaluations.models import Evaluation
    from apps.evaluations.tests.factories import make_cycle

    cycle = make_cycle(open=True)
    Evaluation.objects.create(
        evaluator=member,
        recipient=target,
        cycle=cycle,
        form_version=cycle.form_version,
        status="SUBMITTED",
        submitted_at=timezone.now(),
    )

    # Filter completed
    res_completed = member_client.get(DIRECTORY, {"evaluation_status": "completed"})
    assert res_completed.status_code == 200
    completed_ids = [m["public_id"] for m in res_completed.json()["results"]]
    assert str(target.public_id) in completed_ids
    assert str(not_evaluated.public_id) not in completed_ids

    # Filter pending
    res_pending = member_client.get(DIRECTORY, {"evaluation_status": "pending"})
    assert res_pending.status_code == 200
    pending_ids = [m["public_id"] for m in res_pending.json()["results"]]
    assert str(not_evaluated.public_id) in pending_ids
    assert str(target.public_id) not in pending_ids

    # Filter all
    res_all = member_client.get(DIRECTORY, {"evaluation_status": "all"})
    assert res_all.status_code == 200
    all_ids = [m["public_id"] for m in res_all.json()["results"]]
    assert str(target.public_id) in all_ids
    assert str(not_evaluated.public_id) in all_ids

