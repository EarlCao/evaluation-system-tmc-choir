"""Submission rules shared by selectors (eligibility endpoint) and services (submit/edit),
so the UI hint and the server-side enforcement can never disagree (BR-01, BR-12..14)."""

from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone

from apps.members import selectors as member_selectors

from .constants import CycleStatus, EvaluationScope, EvaluationStatus, Ineligibility
from .models import Evaluation, EvaluationCycle


@dataclass(frozen=True)
class Eligibility:
    can_evaluate: bool
    reason: str | None = None
    existing: Evaluation | None = None

    @property
    def message(self) -> str | None:
        return Ineligibility(self.reason).label if self.reason else None


def window_problem(cycle: EvaluationCycle, now: datetime) -> str | None:
    if cycle.status != CycleStatus.OPEN:
        return Ineligibility.NO_OPEN_CYCLE
    if now < cycle.starts_at:
        return Ineligibility.NOT_STARTED
    if now >= cycle.ends_at:
        return Ineligibility.ENDED
    return None


def latest_own_evaluation(*, evaluator, recipient_id: int, cycle: EvaluationCycle):
    return (
        Evaluation.objects.filter(
            cycle=cycle,
            evaluator=evaluator,
            recipient_id=recipient_id,
            status=EvaluationStatus.SUBMITTED,
        )
        .order_by("-submission_number")
        .first()
    )


def eligibility(
    *, evaluator, recipient_profile, cycle: EvaluationCycle | None, now: datetime | None = None
) -> Eligibility:
    """Can ``evaluator`` evaluate the member behind ``recipient_profile`` right now?"""
    now = now or timezone.now()
    if recipient_profile.user_id == evaluator.pk:
        return Eligibility(False, Ineligibility.SELF)
    evaluator_profile = member_selectors.get_own_profile(user=evaluator)
    # Q9: Super Admins moderate and never evaluate, even if they also have a choir profile.
    if evaluator_profile is None or not evaluator.is_active_member or evaluator.is_super_admin:
        return Eligibility(False, Ineligibility.NOT_A_MEMBER)
    if cycle is None:
        return Eligibility(False, Ineligibility.NO_OPEN_CYCLE)
    problem = window_problem(cycle, now)
    if problem:
        return Eligibility(False, problem)
    if not recipient_profile.is_evaluable:
        return Eligibility(False, Ineligibility.NOT_EVALUABLE)
    if (
        cycle.evaluation_scope == EvaluationScope.SAME_SECTION
        and evaluator_profile.voice_section_id != recipient_profile.voice_section_id
    ):
        return Eligibility(False, Ineligibility.OUT_OF_SCOPE)
    existing = latest_own_evaluation(
        evaluator=evaluator, recipient_id=recipient_profile.user_id, cycle=cycle
    )
    if existing is not None and not cycle.allow_resubmission:
        return Eligibility(False, Ineligibility.ALREADY_EVALUATED, existing)
    return Eligibility(True, existing=existing)


def can_edit(evaluation: Evaluation, now: datetime | None = None) -> bool:
    """MINE-02: authors edit while the cycle is open and before its edit deadline."""
    now = now or timezone.now()
    cycle = evaluation.cycle
    return (
        evaluation.status == EvaluationStatus.SUBMITTED
        and cycle.status == CycleStatus.OPEN
        and now <= cycle.edit_deadline
    )
