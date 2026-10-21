"""Super Admin configuration API (EVAL-02, CFG-*): permissions and happy paths."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from apps.evaluations.constants import CycleStatus, FormStatus
from apps.evaluations.models import EvaluationCycle, FormVersion, RatingCriterion
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form

pytestmark = pytest.mark.django_db


def url(name, *args):
    return reverse(f"evaluations-admin:{name}", args=args)


CRITERION = {
    "name": "Attendance",
    "description": "Comes on time.",
    "scale_type": "NUMERIC",
    "min_value": 1,
    "max_value": 5,
    "step": 1,
    "labels": {"1": "Needs improvement", "5": "Excellent"},
}


@pytest.mark.parametrize(
    ("method", "name"),
    [
        ("get", "criteria"),
        ("post", "criteria"),
        ("get", "forms"),
        ("get", "cycles"),
        ("post", "cycles"),
        ("get", "categories"),
    ],
)
def test_members_and_anonymous_are_refused(api_client, member_client, method, name):
    """BR-04 / BR-09: every admin endpoint is Super Admin only, server-side."""
    assert getattr(api_client, method)(url(name), {}).status_code == 401
    assert getattr(member_client, method)(url(name), {}).status_code == 403


def test_create_and_version_a_criterion(admin_client_api):
    created = admin_client_api.post(url("criteria"), CRITERION)
    assert created.status_code == 201, created.json()
    body = created.json()
    assert body["current_version"]["max_value"] == 5  # JSON number, not "5.00"
    assert body["current_version"]["labels"] == {"1": "Needs improvement", "5": "Excellent"}

    public_id = body["public_id"]
    updated = admin_client_api.patch(url("criterion", public_id), {"name": "Punctuality"})
    assert updated.json()["current_version"]["version"] == 2
    versions = admin_client_api.get(url("criterion-versions", public_id)).json()
    assert [v["version"] for v in versions] == [2, 1]


def test_criterion_validation_errors_use_fields(admin_client_api):
    response = admin_client_api.post(url("criteria"), {**CRITERION, "step": 3})
    assert response.status_code == 400
    assert "step" in response.json()["error"]["fields"]


def test_archive_and_reorder(admin_client_api, super_admin):
    a, b = make_criterion(super_admin), make_criterion(super_admin)
    reordered = admin_client_api.post(
        url("criteria-reorder"), {"order": [str(b.public_id), str(a.public_id)]}
    )
    assert [c["public_id"] for c in reordered.json()] == [str(b.public_id), str(a.public_id)]
    archived = admin_client_api.post(url("criterion-archive", a.public_id))
    assert archived.json()["is_archived"] is True
    assert [c["public_id"] for c in admin_client_api.get(url("criteria")).json()] == [
        str(b.public_id)
    ]


def test_form_draft_update_and_publish(admin_client_api, super_admin):
    c1, c2 = make_criterion(super_admin), make_criterion(super_admin)
    created = admin_client_api.post(
        url("forms"), {"title": "Spring", "criteria": [str(c1.public_id)], "comment_required": True}
    )
    assert created.status_code == 201
    public_id = created.json()["public_id"]
    patched = admin_client_api.patch(
        url("form", public_id), {"criteria": [str(c2.public_id), str(c1.public_id)]}
    )
    assert [i["criterion_public_id"] for i in patched.json()["items"]] == [
        str(c2.public_id),
        str(c1.public_id),
    ]
    published = admin_client_api.post(url("form-publish", public_id))
    assert published.json()["status"] == FormStatus.PUBLISHED
    again = admin_client_api.patch(url("form", public_id), {"title": "Changed"})
    assert again.status_code == 409


def test_cycle_api_lifecycle(admin_client_api, super_admin):
    form = make_form(super_admin)
    now = timezone.now()
    created = admin_client_api.post(
        url("cycles"),
        {
            "name": "Concert prep",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=7)).isoformat(),
            "form_version": str(form.public_id),
            "evaluation_scope": "SAME_SECTION",
        },
    )
    assert created.status_code == 201, created.json()
    body = created.json()
    assert body["form_version"]["version"] == form.version
    assert body["edit_deadline"] == body["ends_at"]
    public_id = body["public_id"]

    assert admin_client_api.post(url("cycle-open", public_id)).json()["status"] == CycleStatus.OPEN
    blocked = admin_client_api.patch(url("cycle", public_id), {"evaluation_scope": "ALL"})
    assert blocked.status_code == 409
    assert (
        admin_client_api.post(url("cycle-close", public_id)).json()["status"] == CycleStatus.CLOSED
    )
    assert (
        admin_client_api.post(url("cycle-archive", public_id)).json()["status"]
        == CycleStatus.ARCHIVED
    )


def test_cycle_with_unknown_form_is_rejected(admin_client_api):
    now = timezone.now()
    response = admin_client_api.post(
        url("cycles"),
        {
            "name": "X",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "form_version": "00000000-0000-4000-8000-000000000000",
        },
    )
    assert response.status_code == 400
    assert "form_version" in response.json()["error"]["fields"]


def test_second_open_cycle_conflicts(admin_client_api, super_admin):
    make_cycle(super_admin, open=True)
    other = make_cycle(super_admin)
    response = admin_client_api.post(url("cycle-open", other.public_id))
    assert response.status_code == 409
    assert "already open" in response.json()["error"]["message"]


def test_unknown_ids_are_404(admin_client_api):
    missing = "00000000-0000-4000-8000-000000000000"
    assert admin_client_api.get(url("criterion", missing)).status_code == 404
    assert admin_client_api.get(url("cycle", missing)).status_code == 404


def test_seed_demo_data_is_idempotent(monkeypatch):
    call_command("seed_demo_data", "--open-cycle")
    call_command("seed_demo_data", "--open-cycle")
    assert RatingCriterion.objects.count() == 6
    assert FormVersion.objects.filter(status=FormStatus.PUBLISHED).count() == 1
    assert EvaluationCycle.objects.get(name="Demo cycle").status == CycleStatus.OPEN


def test_comment_prompts_crud_and_reorder(admin_client_api):
    initial = admin_client_api.get(url("comment-prompts")).json()
    assert len(initial) == 5
    assert initial[0]["label"] == "Comments (Unsay imong ikaingon sa akoa?)"
    assert initial[1]["label"] == "Suggestions (Unsay imong ikasuggest sa akoa?)"

    created = admin_client_api.post(
        url("comment-prompts"),
        {"label": "Appreciation (Unsay imong gikalipay?)", "is_required": True},
    )
    assert created.status_code == 201
    new_id = created.json()["public_id"]

    updated = admin_client_api.patch(
        url("comment-prompt", new_id),
        {"label": "Appreciation (Unsay imong gipasalamatan?)"},
    )
    assert updated.status_code == 200
    assert updated.json()["label"] == "Appreciation (Unsay imong gipasalamatan?)"

    expected_order = [new_id, *[p["public_id"] for p in initial]]
    reordered = admin_client_api.post(
        url("comment-prompts-reorder"),
        {"order": expected_order},
    )
    assert reordered.status_code == 200
    assert [p["public_id"] for p in reordered.json()] == expected_order

    archived = admin_client_api.post(url("comment-prompt-archive", new_id))
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True


def test_create_and_delete_category(admin_client_api, super_admin):
    created = admin_client_api.post(url("categories"), {"name": "Stage Presence"})
    assert created.status_code == 201
    cat_id = created.json()["id"]
    criterion = make_criterion(super_admin, category_id=cat_id)
    assert criterion.category_id == cat_id

    deleted = admin_client_api.delete(url("category", cat_id))
    assert deleted.status_code == 204
    criterion.refresh_from_db()
    assert criterion.category_id == cat_id
    assert criterion.category.is_archived is True
    assert not any(c["id"] == cat_id for c in admin_client_api.get(url("categories")).json())
