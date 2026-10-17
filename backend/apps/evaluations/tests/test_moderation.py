"""Step 4.4: all-evaluations browser, identity-access auditing and moderation (ADM-02/03/05)."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.core.models import AppendOnlyViolation
from apps.evaluations import services
from apps.evaluations.constants import ModerationStatus
from apps.evaluations.models import EvaluationComment, ModerationAction
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db


def url(name, *args):
    return reverse(f"evaluations-admin:{name}", args=args)


@pytest.fixture
def world(super_admin):
    attendance = make_criterion(super_admin, name="Attendance")
    blend = make_criterion(super_admin, name="Blend")
    form = make_form(super_admin, criteria=[attendance, blend])
    cycle = make_cycle(super_admin, form=form, open=True)
    cv = {i.criterion_version.criterion_id: i.criterion_version_id for i in form.items.all()}
    recipient = MemberProfileFactory().user
    alice, bob = MemberProfileFactory().user, MemberProfileFactory().user

    def rate(evaluator, attendance_value, blend_value, comment):
        return services.submit_evaluation(
            evaluator=evaluator,
            recipient_public_id=recipient.public_id,
            ratings=[
                {"criterion_version": cv[attendance.pk], "value": attendance_value},
                {"criterion_version": cv[blend.pk], "value": blend_value},
            ],
            comment=comment,
            suggestion="Breathe earlier.",
        )

    return {
        "cycle": cycle,
        "recipient": recipient,
        "alice": alice,
        "bob": bob,
        "attendance": attendance,
        "low": rate(alice, 2, 5, "Sometimes late."),
        "high": rate(bob, 5, 3, "Always first in."),
    }


def _received_texts(user):
    client = APIClient()
    client.force_login(user)
    rows = client.get(reverse("feedback:received")).json()["results"]
    return {(row.get("comment") or "") for row in rows}


@pytest.mark.parametrize(
    ("method", "name", "needs_id"),
    [
        ("get", "evaluations", False),
        ("get", "moderation-queue", False),
        ("get", "evaluation", True),
        ("get", "evaluation-revisions", True),
        ("post", "evaluation-moderate", True),
    ],
)
def test_only_super_admins(world, api_client, member_client, method, name, needs_id):
    target = url(name, world["low"].public_id) if needs_id else url(name)
    assert getattr(api_client, method)(target, {}).status_code == 401
    assert getattr(member_client, method)(target, {}).status_code == 403


def test_list_shows_identities_and_is_audited(world, admin_client_api, super_admin):
    response = admin_client_api.get(url("evaluations"), {"recipient": world["recipient"].public_id})
    assert response.status_code == 200
    rows = response.json()["results"]
    assert {r["evaluator"]["public_id"] for r in rows} == {
        str(world["alice"].public_id),
        str(world["bob"].public_id),
    }
    assert rows[0]["ratings"][0]["criterion_name"] == "Attendance"
    log = AuditLog.objects.get(event_type="admin.sensitive_access")
    assert log.actor == super_admin
    assert log.metadata["view"] == "evaluations.list"
    assert log.metadata["filters"] == {"recipient": str(world["recipient"].public_id)}
    assert log.metadata["results"] == 2
    assert response["Cache-Control"].startswith("no-store")


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ({"evaluator": "alice"}, {"low"}),
        ({"rating_max": 2}, {"low"}),
        ({"criterion": "attendance", "rating_min": 4}, {"high"}),
        ({"criterion": "attendance", "rating_max": 3}, {"low"}),
        ({"rating_min": 3, "rating_max": 3}, {"high"}),
        ({"edited": "true"}, set()),
        ({"moderation": "VISIBLE"}, {"low", "high"}),
    ],
)
def test_filters(world, admin_client_api, query, expected):
    params = {
        k: (world[v].public_id if k in ("evaluator", "criterion") else v) for k, v in query.items()
    }
    params["cycle"] = world["cycle"].public_id
    rows = admin_client_api.get(url("evaluations"), params).json()["results"]
    by_id = {str(world[k].public_id): k for k in ("low", "high")}
    assert {by_id[r["public_id"]] for r in rows} == expected


def test_filter_validation(admin_client_api):
    response = admin_client_api.get(url("evaluations"), {"rating_min": 4, "rating_max": 2})
    assert response.status_code == 400
    assert "rating_max" in response.json()["error"]["fields"]
    assert AuditLog.objects.filter(event_type="admin.sensitive_access").count() == 0


def test_detail_and_revisions_include_editor_and_are_audited(world, admin_client_api):
    evaluation = world["low"]
    services.edit_evaluation(
        editor=world["alice"],
        evaluation_public_id=evaluation.public_id,
        ratings=[
            {"criterion_version": r.criterion_version_id, "value": 3}
            for r in evaluation.ratings.all()
        ],
        comment="Mostly on time now.",
    )
    detail = admin_client_api.get(url("evaluation", evaluation.public_id)).json()
    assert detail["evaluator"]["public_id"] == str(world["alice"].public_id)
    assert detail["is_edited"] is True
    assert detail["comment"] == {"body": "Mostly on time now.", "moderation_status": "VISIBLE"}
    revisions = admin_client_api.get(url("evaluation-revisions", evaluation.public_id)).json()
    assert [r["revision_number"] for r in revisions] == [1, 2]
    assert revisions[1]["editor"]["public_id"] == str(world["alice"].public_id)
    views = list(
        AuditLog.objects.filter(event_type="admin.sensitive_access")
        .order_by("id")
        .values_list("metadata__view", "target_id")
    )
    assert views == [
        ("evaluations.detail", str(evaluation.public_id)),
        ("evaluations.revisions", str(evaluation.public_id)),
    ]


def test_hide_comment_removes_it_from_the_recipient_and_keeps_history(
    world, admin_client_api, django_capture_on_commit_callbacks
):
    recipient = world["recipient"]
    assert "Sometimes late." in _received_texts(recipient)
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_client_api.post(
            url("evaluation-moderate", world["low"].public_id),
            {"action": "HIDE", "target": "COMMENT", "reason": "Personal remark"},
            format="json",
        )
    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["comment"]["moderation_status"] == "HIDDEN"
    assert body["moderation_status"] == "VISIBLE"
    assert body["moderation_history"][0]["reason"] == "Personal remark"
    assert "Sometimes late." not in _received_texts(recipient)
    # Never deleted (BR-17): the text is still stored and can be restored.
    assert EvaluationComment.objects.filter(body="Sometimes late.").exists()

    with django_capture_on_commit_callbacks(execute=True):
        admin_client_api.post(
            url("evaluation-moderate", world["low"].public_id),
            {"action": "RESTORE", "target": "COMMENT"},
            format="json",
        )
    assert "Sometimes late." in _received_texts(recipient)
    assert list(ModerationAction.objects.values_list("action", flat=True)) == ["HIDE", "RESTORE"]
    audit = AuditLog.objects.filter(event_type="evaluations.evaluation.moderated").order_by("id")
    assert audit.count() == 2
    assert audit.first().after == {"moderation_status": "HIDDEN"}


def test_hiding_a_whole_evaluation(world, super_admin):
    services.moderate(
        actor=super_admin,
        evaluation=world["high"],
        action="HIDE",
        target="EVALUATION",
        reason="Abusive",
    )
    assert _received_texts(world["recipient"]) == {"Sometimes late."}


def test_flagged_items_form_the_queue_and_stay_visible(world, admin_client_api, super_admin):
    services.moderate(
        actor=super_admin,
        evaluation=world["high"],
        action="FLAG",
        target="SUGGESTION",
        reason="Check",
    )
    queue = admin_client_api.get(url("moderation-queue")).json()
    assert [r["public_id"] for r in queue["results"]] == [str(world["high"].public_id)]
    assert queue["results"][0]["needs_attention"] is True
    assert queue["results"][0]["suggestion"]["moderation_status"] == "FLAGGED"
    assert "Always first in." in _received_texts(world["recipient"])
    attention = admin_client_api.get(url("evaluations"), {"moderation": "attention"}).json()
    assert attention["count"] == 1
    log = AuditLog.objects.filter(event_type="admin.sensitive_access").order_by("id").first()
    assert log.metadata["view"] == "evaluations.moderation_queue"


@pytest.mark.parametrize(
    ("action", "target", "reason", "error"),
    [
        ("HIDE", "COMMENT", "", ValidationError),
        ("FLAG", "EVALUATION", "   ", ValidationError),
        ("RESTORE", "EVALUATION", "", BusinessRuleViolation),  # already visible
        ("ERASE", "EVALUATION", "x", ValidationError),
    ],
)
def test_moderation_rules(world, super_admin, action, target, reason, error):
    with pytest.raises(error):
        services.moderate(
            actor=super_admin, evaluation=world["low"], action=action, target=target, reason=reason
        )
    assert not ModerationAction.objects.exists()


def test_missing_text_cannot_be_moderated(world, super_admin):
    EvaluationComment.objects.filter(evaluation=world["low"], kind="SUGGESTION").delete()
    with pytest.raises(BusinessRuleViolation):
        services.moderate(
            actor=super_admin,
            evaluation=world["low"],
            action="FLAG",
            target="SUGGESTION",
            reason="x",
        )


def test_moderation_history_is_append_only(world, super_admin):
    services.moderate(
        actor=super_admin, evaluation=world["low"], action="FLAG", target="EVALUATION", reason="x"
    )
    entry = ModerationAction.objects.get()
    entry.reason = "edited"
    with pytest.raises(AppendOnlyViolation):
        entry.save()
    with pytest.raises(AppendOnlyViolation):
        ModerationAction.objects.all().delete()
    world["low"].refresh_from_db()
    assert world["low"].moderation_status == ModerationStatus.FLAGGED
