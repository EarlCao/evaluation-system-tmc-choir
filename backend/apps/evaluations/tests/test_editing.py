"""Step 3.1: editing + immutable revisions (MINE-02/03/04/07, BR-05, BR-07)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation, NotFound, ValidationError
from apps.evaluations import services
from apps.evaluations.constants import ModerationStatus
from apps.evaluations.models import EvaluationComment, EvaluationCycle
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def form(super_admin):
    return make_form(super_admin, criteria=[make_criterion(super_admin, name="Attendance")])


@pytest.fixture
def cycle(super_admin, form):
    return make_cycle(super_admin, form=form, open=True)


@pytest.fixture
def recipient():
    return MemberProfileFactory().user


@pytest.fixture
def evaluation(member, recipient, form, cycle):
    return services.submit_evaluation(
        evaluator=member,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": 3}],
        comment="First thoughts",
    )


def edit(member, evaluation, value=5, comment="Second thoughts", **kwargs):
    cv = evaluation.form_version.items.get().criterion_version_id
    return services.edit_evaluation(
        editor=member,
        evaluation_public_id=evaluation.public_id,
        ratings=[{"criterion_version": cv, "value": value}],
        comment=comment,
        **kwargs,
    )


def test_edit_writes_next_revision_and_keeps_the_original(
    member, evaluation, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        edited = edit(member, evaluation, change_summary="Changed my mind")
    assert edited.is_edited is True
    assert edited.current_revision_number == 2
    assert edited.last_edited_at is not None
    assert edited.ratings.get().value == Decimal(5)
    assert edited.comments.get(kind="COMMENT").body == "Second thoughts"

    r1, r2 = edited.revisions.order_by("revision_number")
    assert (r1.snapshot["comment"], r1.snapshot["ratings"][0]["value"]) == ("First thoughts", "3")
    assert (r2.snapshot["comment"], r2.snapshot["ratings"][0]["value"]) == ("Second thoughts", "5")
    assert (r2.editor, r2.change_summary) == (member, "Changed my mind")
    entry = AuditLog.objects.get(event_type="evaluations.evaluation.edited")
    assert entry.metadata == {"revision_number": 2}
    assert "Second thoughts" not in str(entry.metadata)  # content lives in revisions (AUD-05)


def test_identical_content_is_a_no_op(member, evaluation):
    edit(member, evaluation, value=3, comment="First thoughts")
    evaluation.refresh_from_db()
    assert evaluation.revisions.count() == 1
    assert evaluation.is_edited is False


def test_revision_numbers_are_sequential(member, evaluation):
    for i, value in enumerate([4, 5, 2], start=2):
        assert edit(member, evaluation, value=value, comment=f"v{i}").current_revision_number == i
    assert list(evaluation.revisions.values_list("revision_number", flat=True)) == [1, 2, 3, 4]


def test_only_the_author_can_edit(recipient, evaluation):
    """MINE-07 / BR-02: the recipient and other members get 404, not 403."""
    with pytest.raises(NotFound):
        edit(recipient, evaluation)
    with pytest.raises(NotFound):
        edit(MemberProfileFactory().user, evaluation)


def test_edit_window_closes_at_the_deadline(member, evaluation, cycle):
    EvaluationCycle.objects.filter(pk=cycle.pk).update(
        edit_deadline=timezone.now() - timedelta(seconds=1)
    )
    with pytest.raises(BusinessRuleViolation, match="edit window"):
        edit(member, evaluation)


def test_no_edits_once_the_cycle_is_closed(member, evaluation, cycle, super_admin):
    services.close_cycle(actor=super_admin, cycle=cycle)
    with pytest.raises(BusinessRuleViolation):
        edit(member, evaluation)


def test_edit_deadline_after_end_still_allows_edits(member, evaluation, cycle, super_admin):
    """CFG-05: authors may fix typos after submissions close if the deadline allows it."""
    services.update_cycle(
        actor=super_admin, cycle=cycle, edit_deadline=cycle.ends_at + timedelta(days=2)
    )
    assert edit(member, evaluation).current_revision_number == 2


def test_edit_validates_against_the_original_form(member, evaluation, super_admin):
    """BR-07: a newer criterion version doesn't change what this evaluation is validated against."""
    criterion = evaluation.form_version.items.get().criterion_version.criterion
    services.update_criterion(actor=super_admin, criterion=criterion, max_value=10)
    with pytest.raises(ValidationError):
        edit(member, evaluation, value=8)  # valid only for the new version
    assert edit(member, evaluation, value=5).ratings.get().value == Decimal(5)


def test_edit_keeps_moderation_status(member, evaluation):
    EvaluationComment.objects.filter(evaluation=evaluation, kind="COMMENT").update(
        moderation_status=ModerationStatus.HIDDEN
    )
    edited = edit(member, evaluation, comment="Polite now")
    assert edited.comments.get(kind="COMMENT").moderation_status == ModerationStatus.HIDDEN


def test_edit_validation(member, evaluation):
    with pytest.raises(ValidationError) as exc:
        edit(member, evaluation, value=9, comment="")
    assert "ratings" in exc.value.fields
    with pytest.raises(ValidationError):
        edit(member, evaluation, change_summary="x" * 201)


# --------------------------------------------------------------------------- API
def detail_url(evaluation):
    return reverse("evaluations:mine-detail", args=[evaluation.public_id])


def test_patch_api(member_client, evaluation):
    cv = evaluation.form_version.items.get().criterion_version_id
    response = member_client.patch(
        detail_url(evaluation),
        {
            "ratings": [{"criterion_version": cv, "value": 4}],
            "comment": "Updated",
            "change_summary": "Typo",
        },
    )
    assert response.status_code == 200, response.json()
    body = response.json()
    assert (body["is_edited"], body["current_revision_number"], body["comment"]) == (
        True,
        2,
        "Updated",
    )


def test_patch_after_window_is_409(member_client, evaluation, cycle):
    EvaluationCycle.objects.filter(pk=cycle.pk).update(
        edit_deadline=timezone.now() - timedelta(seconds=1)
    )
    cv = evaluation.form_version.items.get().criterion_version_id
    response = member_client.patch(
        detail_url(evaluation), {"ratings": [{"criterion_version": cv, "value": 4}], "comment": "x"}
    )
    assert response.status_code == 409
    assert member_client.get(detail_url(evaluation)).json()["can_edit"] is False


def test_revisions_api_is_author_only(member_client, member, recipient, evaluation):
    edit(member, evaluation)
    url = reverse("evaluations:mine-revisions", args=[evaluation.public_id])
    revisions = member_client.get(url).json()
    assert [r["revision_number"] for r in revisions] == [1, 2]
    assert revisions[0]["snapshot"]["comment"] == "First thoughts"
    assert "editor" not in revisions[1]  # always the author; no identity field (step 3.4)

    other = APIClient()
    other.force_login(recipient)
    assert other.get(url).status_code == 404  # the recipient never sees the history (MINE-05)
    assert other.patch(detail_url(evaluation), {"ratings": []}).status_code == 404
