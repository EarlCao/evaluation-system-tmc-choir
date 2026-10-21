"""BR-12: eligibility must be rechecked after taking the submission lock."""

import pytest
from django.utils import timezone

from apps.core.exceptions import BusinessRuleViolation
from apps.evaluations import rules, services
from apps.evaluations.models import Evaluation
from apps.evaluations.tests.factories import make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db


def test_submission_that_appears_after_initial_eligibility_is_not_duplicated(monkeypatch):
    form = make_form()
    cycle = make_cycle(form=form, open=True)
    evaluator, recipient = MemberProfileFactory().user, MemberProfileFactory().user
    original = rules.eligibility
    inserted = False

    def concurrent_eligibility(**kwargs):
        nonlocal inserted
        verdict = original(**kwargs)
        if not inserted:
            inserted = True
            Evaluation.objects.create(
                cycle=cycle,
                evaluator=evaluator,
                recipient=recipient,
                form_version=form,
                submitted_at=timezone.now(),
            )
        return verdict

    monkeypatch.setattr(rules, "eligibility", concurrent_eligibility)
    with pytest.raises(BusinessRuleViolation):
        services.submit_evaluation(
            evaluator=evaluator,
            recipient_public_id=recipient.public_id,
            ratings=[
                {"criterion_version": item.criterion_version_id, "value": 4}
                for item in form.items.all()
            ],
        )
    assert (
        Evaluation.objects.filter(cycle=cycle, evaluator=evaluator, recipient=recipient).count()
        == 1
    )
