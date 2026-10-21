"""PRIV-02: repeated or missing ratings cannot satisfy anonymity thresholds."""

import pytest

from apps.evaluations import services
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.feedback.selectors import summary
from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db


def test_resubmissions_from_one_person_stay_suppressed():
    form = make_form(criteria=[make_criterion()])
    make_cycle(form=form, open=True, allow_resubmission=True)
    evaluator, recipient = MemberProfileFactory().user, MemberProfileFactory().user
    for value in (3, 4, 5):
        services.submit_evaluation(
            evaluator=evaluator,
            recipient_public_id=recipient.public_id,
            ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": value}],
        )
    data = summary(recipient=recipient)
    assert data["evaluations_received"] == 3
    assert data["criteria"][0]["average"] is None
    assert data["criteria"][0]["suppressed"] is True
    assert data["trend"][0]["average_percent"] is None


def test_three_evaluations_but_only_one_rating_suppresses_trend():
    form = make_form(criteria=[make_criterion(is_required=False)])
    make_cycle(form=form, open=True)
    recipient = MemberProfileFactory().user
    for value in (4, None, None):
        services.submit_evaluation(
            evaluator=MemberProfileFactory().user,
            recipient_public_id=recipient.public_id,
            ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": value}],
        )
    data = summary(recipient=recipient)
    assert data["criteria"][0]["suppressed"] is True
    assert data["trend"][0]["suppressed"] is True
    assert data["trend"][0]["average_percent"] is None
