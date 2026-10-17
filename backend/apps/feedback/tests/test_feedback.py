"""Step 3.2: anonymised feedback (FB-01..06, MINE-05/06, REP-02/04/06, BR-03/06/15/16).

Every API test runs ``assert_no_evaluator_leak`` against ALL evaluators."""

import re
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.core.testing.privacy import assert_no_evaluator_leak
from apps.evaluations import services
from apps.evaluations.constants import ModerationStatus
from apps.evaluations.models import Evaluation, EvaluationComment
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.feedback import selectors
from apps.feedback.selectors import feedback_id
from apps.members.tests.factories import MemberProfileFactory
from apps.system import services as system_services

pytestmark = pytest.mark.django_db

ITEM_KEYS = {"feedback_id", "cycle", "date", "is_edited", "comment", "suggestion"}


@pytest.fixture
def form(super_admin):
    return make_form(
        super_admin,
        criteria=[
            make_criterion(super_admin, name="Attendance"),
            make_criterion(super_admin, name="Solo work", is_required=False),
        ],
    )


@pytest.fixture
def cycle(super_admin, form):
    return make_cycle(super_admin, form=form, open=True)


@pytest.fixture
def evaluators():
    return [MemberProfileFactory().user for _ in range(4)]


def submit(evaluator, recipient, form, values=(4, None), comment="", suggestion=""):
    items = [i.criterion_version_id for i in form.items.order_by("order")]
    return services.submit_evaluation(
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[
            {"criterion_version": cv, "value": v} for cv, v in zip(items, values, strict=True)
        ],
        comment=comment,
        suggestion=suggestion,
    )


def url(name):
    return reverse(f"feedback:{name}")


# --------------------------------------------------------------------------- list
def test_list_is_anonymised_and_whitelisted(member_client, member, evaluators, form, cycle):
    for i, ev in enumerate(evaluators[:3]):
        submit(ev, member, form, comment=f"Comment {i}", suggestion=f"Idea {i}")
    response = member_client.get(url("received"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 3
    for item in payload["results"]:
        assert set(item) == ITEM_KEYS
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", item["date"])  # day precision only
        assert item["cycle"]["name"] == cycle.name
    assert_no_evaluator_leak(response, *evaluators)


def test_feedback_ids_are_opaque_stable_and_not_public_ids(member, evaluators, form, cycle):
    evaluation = submit(evaluators[0], member, form, comment="Hi")
    first = selectors.list_received(recipient=member)[0].feedback_id
    assert first == selectors.list_received(recipient=member)[0].feedback_id  # stable
    assert first == feedback_id(evaluation.pk, member.pk)
    assert first != str(evaluation.public_id)
    assert str(evaluation.pk) not in first
    assert re.fullmatch(r"[A-Z2-7]{16}", first)


def test_order_is_time_neutral(member, evaluators, form, cycle):
    """Privacy Model §3: inside a cycle, items are ordered by opaque id, not by submission time."""
    for i, ev in enumerate(evaluators):
        submit(ev, member, form, comment=f"c{i}")
    ids = [item.feedback_id for item in selectors.list_received(recipient=member)]
    assert ids == sorted(ids)


def test_evaluations_without_text_are_counted_but_not_listed(member, evaluators, form, cycle):
    submit(evaluators[0], member, form, comment="")
    submit(evaluators[1], member, form, comment="Words")
    assert len(selectors.list_received(recipient=member)) == 1
    assert selectors.count_received(recipient=member) == 2


def test_edited_label_without_editor(member_client, member, evaluators, form, cycle):
    """MINE-05 / MINE-06: current content + Edited flag, never who edited."""
    evaluation = submit(evaluators[0], member, form, comment="Old")
    services.edit_evaluation(
        editor=evaluators[0],
        evaluation_public_id=evaluation.public_id,
        ratings=[
            {"criterion_version": form.items.order_by("order")[0].criterion_version_id, "value": 5}
        ],
        comment="New",
    )
    response = member_client.get(url("received"))
    (item,) = response.json()["results"]
    assert (item["comment"], item["is_edited"]) == ("New", True)
    assert "Old" not in str(response.json())  # history never reaches the recipient
    assert_no_evaluator_leak(response, *evaluators)


def test_hidden_moderation_is_excluded(member, evaluators, form, cycle):
    hidden = submit(evaluators[0], member, form, comment="Rude")
    partly = submit(evaluators[1], member, form, comment="Also rude", suggestion="Useful idea")
    Evaluation.objects.filter(pk=hidden.pk).update(moderation_status=ModerationStatus.HIDDEN)
    EvaluationComment.objects.filter(evaluation=partly, kind="COMMENT").update(
        moderation_status=ModerationStatus.HIDDEN
    )
    items = selectors.list_received(recipient=member)
    assert [(i.comment, i.suggestion) for i in items] == [("", "Useful idea")]
    assert selectors.count_received(recipient=member) == 1


def test_after_close_visibility(member, evaluators, form, super_admin):
    cycle = make_cycle(super_admin, form=form, open=True, feedback_visibility="AFTER_CLOSE")
    submit(evaluators[0], member, form, comment="Wait for it")
    assert selectors.count_received(recipient=member) == 0
    assert selectors.list_received(recipient=member) == []
    services.close_cycle(actor=super_admin, cycle=cycle)
    assert selectors.count_received(recipient=member) == 1


def test_members_only_see_their_own_feedback(member_client, member, evaluators, form, cycle):
    submit(member, evaluators[0], form, comment="For someone else")
    assert member_client.get(url("received")).json()["count"] == 0
    assert member_client.get(url("count")).json() == {"evaluations_received": 0}


def test_date_filters(member_client, member, evaluators, form, cycle):
    submit(evaluators[0], member, form, comment="Today")
    today = selectors.list_received(recipient=member)[0].date.isoformat()
    assert member_client.get(url("received"), {"date_from": today}).json()["count"] == 1
    assert member_client.get(url("received"), {"date_to": "2000-01-01"}).json()["count"] == 0
    assert member_client.get(url("received"), {"date_from": "17/10/2026"}).status_code == 400
    assert member_client.get(url("received"), {"cycle": "nope"}).status_code == 400


# --------------------------------------------------------------------------- summary
def test_aggregates_are_suppressed_below_the_threshold(member, evaluators, form, cycle):
    """BR-16 / REP-06 / ADR-013."""
    for ev in evaluators[:2]:
        submit(ev, member, form, values=(5, None))
    data = selectors.summary(recipient=member)
    (attendance,) = data["criteria"]
    assert (attendance["n"], attendance["suppressed"]) == (2, True)
    assert attendance["average"] is None
    assert attendance["distribution"] is None
    assert data["trend"][0]["suppressed"] is True
    assert data["evaluations_received"] == 2  # the count is always shown


def test_aggregates_shown_at_the_threshold_and_missing_is_not_zero(member, evaluators, form, cycle):
    """BR-15: the optional criterion rated once is suppressed, not averaged as zeros."""
    submit(evaluators[0], member, form, values=(3, 2))
    submit(evaluators[1], member, form, values=(4, None))
    submit(evaluators[2], member, form, values=(5, None))
    data = selectors.summary(recipient=member)
    by_name = {c["criterion"]: c for c in data["criteria"]}
    attendance, solo = by_name["Attendance"], by_name["Solo work"]
    assert (attendance["n"], attendance["suppressed"], attendance["average"]) == (
        3,
        False,
        Decimal("4.00"),
    )
    assert attendance["distribution"] == {"3": 1, "4": 1, "5": 1}
    assert (solo["n"], solo["suppressed"], solo["average"]) == (1, True, None)
    assert data["trend"][0]["average_percent"] is not None


def test_trend_uses_percent_of_scale(member, evaluators, form, cycle):
    for ev in evaluators[:3]:
        submit(ev, member, form, values=(5, None))  # 5 on 1..5 = 100 %
    assert selectors.summary(recipient=member)["trend"][0]["average_percent"] == Decimal("100.00")


def test_threshold_follows_the_setting(member, evaluators, form, cycle, super_admin):
    for ev in evaluators[:3]:
        submit(ev, member, form, values=(4, None))
    system_services.update_settings(actor=super_admin, min_aggregate_group_size=4)
    from apps.system.selectors import invalidate_settings_cache

    invalidate_settings_cache()
    assert selectors.summary(recipient=member)["criteria"][0]["suppressed"] is True


def test_criterion_filter_keeps_suppression(member, evaluators, form, cycle):
    for ev in evaluators[:3]:
        submit(ev, member, form, values=(4, None))
    solo = form.items.order_by("order")[1].criterion_version.criterion
    data = selectors.summary(recipient=member, criterion_public_id=solo.public_id)
    assert data["criteria"] == []  # nobody rated it, so nothing (and certainly no zeros)


def test_summary_api_is_anonymous(
    member_client, member, evaluators, form, cycle, django_assert_max_num_queries
):
    for ev in evaluators:
        submit(ev, member, form, values=(4, 4), comment="ok")
    with django_assert_max_num_queries(12):
        response = member_client.get(url("summary"))
    assert response.status_code == 200
    body = response.json()
    assert body["threshold"] == 3
    assert {c["criterion"] for c in body["criteria"]} == {"Attendance", "Solo work"}
    assert_no_evaluator_leak(response, *evaluators)
    assert_no_evaluator_leak(member_client.get(url("count")), *evaluators)
    assert_no_evaluator_leak(member_client.get(reverse("reports:dashboard")), *evaluators)


def test_dashboard_counts_feedback(member_client, member, evaluators, form, cycle):
    submit(evaluators[0], member, form, comment="x")
    assert member_client.get(reverse("reports:dashboard")).json()["feedback_received"] == 1


def test_anonymous_is_refused(api_client):
    for name in ("received", "summary", "count"):
        assert api_client.get(url(name)).status_code == 401
