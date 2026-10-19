"""Step 2.3: eligibility and submission (EVAL-01/05/07/08, MINE-01, BR-01/02/05/12/13/14)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.tests.factories import UserFactory
from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.core.models import AppendOnlyViolation
from apps.evaluations import services
from apps.evaluations.models import EvaluationRevision
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory, voice_section

pytestmark = pytest.mark.django_db


@pytest.fixture
def form(super_admin):
    required = make_criterion(super_admin, name="Attendance")
    optional = make_criterion(super_admin, name="Solo work", is_required=False)
    return make_form(
        super_admin, criteria=[required, optional], comment_required=True, comment_max_length=50
    )


@pytest.fixture
def cycle(super_admin, form):
    return make_cycle(super_admin, form=form, open=True)


@pytest.fixture
def recipient():
    return MemberProfileFactory(voice_section=voice_section("Alto")).user


def items(form):
    return [i.criterion_version for i in form.items.order_by("order")]


def payload(form, values=(4, None), comment="Great energy!", suggestion=""):
    return [
        {"criterion_version": cv.pk, "value": v} for cv, v in zip(items(form), values, strict=True)
    ]


def submit(member, recipient, form, **kwargs):
    return services.submit_evaluation(
        evaluator=member,
        recipient_public_id=recipient.public_id,
        ratings=kwargs.pop("ratings", payload(form)),
        comment=kwargs.pop("comment", "Great energy!"),
        suggestion=kwargs.pop("suggestion", ""),
    )


# --------------------------------------------------------------------------- happy path
def test_submit_creates_evaluation_ratings_comment_and_revision_one(
    member, recipient, form, cycle, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        evaluation = submit(member, recipient, form, suggestion="Breathe at bar 12")
    assert (evaluation.evaluator, evaluation.recipient, evaluation.cycle) == (
        member,
        recipient,
        cycle,
    )
    assert evaluation.form_version == form
    ratings = {r.criterion_version.name: r for r in evaluation.ratings.all()}
    assert ratings["Attendance"].value == Decimal(4)
    assert ratings["Attendance"].label == "Good"
    assert ratings["Solo work"].value is None  # optional, not rated — not zero (BR-15)
    assert {c.kind: c.body for c in evaluation.comments.all()} == {
        "COMMENT": "Great energy!",
        "SUGGESTION": "Breathe at bar 12",
    }
    revision = evaluation.revisions.get()
    assert revision.revision_number == 1
    assert revision.editor == member
    assert revision.snapshot["comment"] == "Great energy!"
    assert revision.snapshot["ratings"][0]["value"] == "4"
    entry = AuditLog.objects.get(event_type="evaluations.evaluation.submitted")
    assert entry.actor == member
    assert entry.target_id == str(evaluation.public_id)


def test_revisions_are_immutable(member, recipient, form, cycle):
    revision = submit(member, recipient, form).revisions.get()
    revision.change_summary = "tampered"
    with pytest.raises(AppendOnlyViolation):
        revision.save()
    with pytest.raises(AppendOnlyViolation):
        EvaluationRevision.objects.all().delete()


def test_text_is_cleaned(member, recipient, form, cycle):
    evaluation = submit(member, recipient, form, comment="  Hi​ there\r\n\x07ok  ")
    assert evaluation.comments.get(kind="COMMENT").body == "Hi there\nok"


# --------------------------------------------------------------------------- business rules
def test_can_evaluate_yourself_and_view_publicly(member_client, member, recipient, form, cycle):
    """Members can evaluate themselves and all members can see it publicly on their profile."""
    evaluation = submit(member, member, form, suggestion="Practice scales daily")
    assert evaluation.evaluator == member
    assert evaluation.recipient == member

    from rest_framework.test import APIClient

    other_client = APIClient()
    other_client.force_login(recipient)
    profile_resp = other_client.get(reverse("members:detail", args=[member.public_id]))
    assert profile_resp.status_code == 200
    self_eval = profile_resp.json()["self_evaluation"]
    assert self_eval is not None
    assert self_eval["public_id"] == str(evaluation.public_id)
    assert self_eval["comment"] == "Great energy!"
    assert self_eval["suggestion"] == "Practice scales daily"
    assert self_eval["ratings"][0]["value"] == 4.0

    dir_resp = other_client.get(reverse("members:directory"))
    entry = next(m for m in dir_resp.json()["results"] if m["public_id"] == str(member.public_id))
    assert entry["has_self_evaluation"] is True
    assert entry["self_evaluation_summary"] == "Great energy!"


def test_only_once_per_cycle_unless_resubmission_allowed(member, recipient, form, super_admin):
    """BR-12 / EVAL-08"""
    cycle = make_cycle(super_admin, form=form, open=True)
    submit(member, recipient, form)
    with pytest.raises(BusinessRuleViolation, match="already evaluated"):
        submit(member, recipient, form)

    services.close_cycle(actor=super_admin, cycle=cycle)
    again = make_cycle(super_admin, form=form, open=True, allow_resubmission=True)
    first, second = submit(member, recipient, form), submit(member, recipient, form)
    assert (first.cycle, second.cycle) == (again, again)
    assert (first.submission_number, second.submission_number) == (1, 2)


def test_requires_open_cycle_within_window(member, recipient, form, super_admin):
    """BR-13"""
    with pytest.raises(BusinessRuleViolation, match="no open"):
        submit(member, recipient, form)
    make_cycle(
        super_admin,
        form=form,
        open=True,
        starts_at=timezone.now() + timedelta(hours=2),
        ends_at=timezone.now() + timedelta(days=2),
    )
    with pytest.raises(BusinessRuleViolation, match="not started"):
        submit(member, recipient, form)


def test_ended_cycle_rejects_submissions(member, recipient, form, cycle):
    type(cycle).objects.filter(pk=cycle.pk).update(
        starts_at=timezone.now() - timedelta(days=3),
        ends_at=timezone.now() - timedelta(minutes=1),
        edit_deadline=timezone.now() - timedelta(minutes=1),
    )
    with pytest.raises(BusinessRuleViolation, match="ended"):
        submit(member, recipient, form)


@pytest.mark.parametrize("trait", ["pending", "suspended", "deactivated"])
def test_inactive_recipients_are_not_found(member, form, cycle, trait):
    """BR-14"""
    hidden = MemberProfileFactory(user=UserFactory(**{trait: True})).user
    from apps.core.exceptions import NotFound

    with pytest.raises(NotFound):
        submit(member, hidden, form)


def test_non_evaluable_recipient(member, form, cycle):
    conductor = MemberProfileFactory(is_evaluable=False).user
    with pytest.raises(BusinessRuleViolation, match="not part of evaluations"):
        submit(member, conductor, form)


def test_same_section_scope(member, recipient, form, super_admin):
    make_cycle(super_admin, form=form, open=True, evaluation_scope="SAME_SECTION")
    with pytest.raises(BusinessRuleViolation, match="own voice section"):
        submit(member, recipient, form)  # member is Tenor, recipient Alto
    tenor = MemberProfileFactory(voice_section=voice_section("Tenor")).user
    assert submit(member, tenor, form).pk


def test_super_admin_cannot_submit(super_admin, recipient, form, cycle):
    """Open Question Q9 default: the Super Admin moderates, does not evaluate."""
    with pytest.raises(BusinessRuleViolation, match="Only choir members"):
        submit(super_admin, recipient, form)


# --------------------------------------------------------------------------- validation
def test_required_ratings_and_comment(member, recipient, form, cycle):
    with pytest.raises(ValidationError) as exc:
        submit(member, recipient, form, ratings=payload(form, (None, None)), comment="")
    assert str(items(form)[0].pk) in exc.value.fields["ratings"]
    assert "comment" in exc.value.fields


@pytest.mark.parametrize("value", [0, 6, "3.5", "abc"])
def test_values_must_be_on_the_scale(member, recipient, form, cycle, value):
    with pytest.raises(ValidationError) as exc:
        submit(member, recipient, form, ratings=payload(form, (value, None)))
    assert str(items(form)[0].pk) in exc.value.fields["ratings"]


def test_unknown_and_duplicate_criteria(member, recipient, form, cycle):
    first = items(form)[0].pk
    with pytest.raises(ValidationError) as exc:
        submit(
            member,
            recipient,
            form,
            ratings=[
                {"criterion_version": first, "value": 4},
                {"criterion_version": first, "value": 5},
                {"criterion_version": 999999, "value": 3},
            ],
        )
    assert set(exc.value.fields["ratings"]) >= {str(first), "999999"}


def test_comment_length_limit(member, recipient, form, cycle):
    with pytest.raises(ValidationError) as exc:
        submit(member, recipient, form, comment="x" * 51)
    assert "comment" in exc.value.fields


# --------------------------------------------------------------------------- API
def api_payload(recipient, form, **extra):
    return {
        "recipient": str(recipient.public_id),
        "ratings": payload(form),
        "comment": "Nice",
        **extra,
    }


def test_current_cycle_and_form_endpoints(member_client, form, cycle):
    current = member_client.get(reverse("evaluations:current-cycle")).json()
    assert current["cycle"]["public_id"] == str(cycle.public_id)
    body = member_client.get(reverse("evaluations:cycle-form", args=[cycle.public_id])).json()
    assert body["comment_required"] is True
    assert [c["name"] for c in body["criteria"]] == ["Attendance", "Solo work"]
    assert body["criteria"][0]["labels"]["5"] == "Excellent"
    assert body["criteria"][0]["max_value"] == 5


def test_no_open_cycle(member_client):
    assert member_client.get(reverse("evaluations:current-cycle")).json() == {"cycle": None}


def test_draft_cycle_form_is_hidden_from_members(member_client, super_admin, form):
    draft = make_cycle(super_admin, form=form)
    assert (
        member_client.get(reverse("evaluations:cycle-form", args=[draft.public_id])).status_code
        == 404
    )


def test_eligibility_endpoint(member_client, member, recipient, form, cycle):
    url = reverse("evaluations:eligibility")
    assert member_client.get(url, {"recipient": recipient.public_id}).json() == {
        "can_evaluate": True,
        "reason": None,
        "message": None,
        "existing_evaluation": None,
    }
    evaluation = submit(member, recipient, form)
    after = member_client.get(url, {"recipient": recipient.public_id}).json()
    assert after["reason"] == "ALREADY_EVALUATED"
    assert after["existing_evaluation"] == str(evaluation.public_id)
    assert member_client.get(url, {"recipient": member.public_id}).json()["can_evaluate"] is True
    assert member_client.get(url, {"recipient": "nope"}).status_code == 400


def test_submit_api_and_my_evaluations(member_client, member, recipient, form, cycle):
    created = member_client.post(reverse("evaluations:submit"), api_payload(recipient, form))
    assert created.status_code == 201, created.json()
    body = created.json()
    assert body["recipient"]["public_id"] == str(recipient.public_id)
    assert body["comment"] == "Nice"
    assert body["can_edit"] is True
    assert body["ratings"][0]["value"] == 4

    mine = member_client.get(reverse("evaluations:mine")).json()
    assert mine["count"] == 1
    detail = member_client.get(reverse("evaluations:mine-detail", args=[body["public_id"]]))
    assert detail.status_code == 200


def test_submit_api_errors(member_client, recipient, form, cycle):
    bad = member_client.post(
        reverse("evaluations:submit"), api_payload(recipient, form, comment="")
    )
    assert bad.status_code == 400
    assert "comment" in bad.json()["error"]["fields"]
    member_client.post(reverse("evaluations:submit"), api_payload(recipient, form))
    dup = member_client.post(reverse("evaluations:submit"), api_payload(recipient, form))
    assert dup.status_code == 409


def test_recipient_cannot_read_evaluations_about_them(member, recipient, form, cycle):
    """BR-02 / privacy: 'mine' is strictly the author's list."""
    from rest_framework.test import APIClient

    evaluation = submit(member, recipient, form)
    client = APIClient()
    client.force_login(recipient)
    assert client.get(reverse("evaluations:mine")).json()["count"] == 0
    detail = client.get(reverse("evaluations:mine-detail", args=[evaluation.public_id]))
    assert detail.status_code == 404


def test_anonymous_is_refused(api_client, form, cycle):
    assert api_client.get(reverse("evaluations:current-cycle")).status_code == 401
    assert api_client.post(reverse("evaluations:submit"), {}).status_code == 401


def test_submission_is_throttled(member_client, settings, form, cycle):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            "evaluation_submit": "2/hour",
        },
    }
    from apps.evaluations.throttles import EvaluationSubmitThrottle

    EvaluationSubmitThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    try:
        codes = [
            member_client.post(reverse("evaluations:submit"), {}).status_code for _ in range(3)
        ]
    finally:
        from rest_framework.settings import api_settings

        EvaluationSubmitThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes == [400, 400, 429]


def test_public_settings_endpoint(api_client):
    body = api_client.get(reverse("system:public")).json()
    assert "Super Admin can see who submitted" in body["privacy_notice"]
    assert set(body) == {
        "system_name",
        "choir_name",
        "choir_description",
        "privacy_notice",
        "registration_mode",
    }


def test_dashboard_shows_cycle_progress(member_client, member, recipient, form, cycle):
    MemberProfileFactory()  # another evaluable member
    submit(member, recipient, form)
    data = member_client.get(reverse("reports:dashboard")).json()["open_cycle"]
    assert data["name"] == cycle.name
    assert data["evaluations_given"] == 1
    assert data["members_left"] == 1


def test_custom_comment_prompts_and_unlimited_words(member_client, member, recipient, super_admin):
    criterion = make_criterion(super_admin, name="Pitch")
    custom_form = services.create_form_version(
        actor=super_admin,
        title="Custom prompts form",
        criteria=[criterion.public_id],
        comment_prompts=[
            {
                "key": "comment",
                "label": "Comments (Unsay imong ikaingon sa akoa?)",
                "is_required": True,
            },
            {
                "key": "suggestion",
                "label": "Suggestions (Unsay imong ikasuggest sa akoa?)",
                "is_required": False,
            },
            {
                "key": "encouragement",
                "label": "Encouragement (Unsay makadasig nimo?)",
                "is_required": False,
            },
        ],
    )
    services.publish_form_version(actor=super_admin, form=custom_form)
    custom_cycle = make_cycle(super_admin, form=custom_form, open=True)

    form_json = member_client.get(
        reverse("evaluations:cycle-form", args=[custom_cycle.public_id])
    ).json()
    assert [p["label"] for p in form_json["comment_prompts"]] == [
        "Comments (Unsay imong ikaingon sa akoa?)",
        "Suggestions (Unsay imong ikasuggest sa akoa?)",
        "Encouragement (Unsay makadasig nimo?)",
    ]

    long_comment = "Maayo kaayo imong tingog ug determinasyon. " * 120
    created = member_client.post(
        reverse("evaluations:submit"),
        {
            "recipient": str(recipient.public_id),
            "ratings": [
                {"criterion_version": custom_form.items.first().criterion_version_id, "value": 5}
            ],
            "comments": {
                "comment": long_comment,
                "suggestion": "Padayon sa pagpraktis.",
                "encouragement": "Kaya nimo!",
            },
        },
        format="json",
    )
    assert created.status_code == 201, created.json()
    body = created.json()
    assert len(body["comments"]) == 3
    assert body["comments"][0]["label"] == "Comments (Unsay imong ikaingon sa akoa?)"
    assert body["comments"][2]["key"] == "encouragement"
    assert body["comments"][2]["body"] == "Kaya nimo!"
