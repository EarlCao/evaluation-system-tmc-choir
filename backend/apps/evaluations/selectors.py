"""Public read API of the evaluations module."""

from uuid import UUID

from django.db.models import Prefetch, QuerySet

from apps.core.exceptions import NotFound
from apps.members import selectors as member_selectors

from . import rules
from .constants import CycleStatus, EvaluationScope, EvaluationStatus, FormStatus
from .models import (
    CriterionCategory,
    CriterionVersion,
    Evaluation,
    EvaluationCycle,
    FormVersion,
    FormVersionItem,
    RatingCriterion,
)


def _get(queryset: QuerySet, **lookup):
    obj = queryset.filter(**lookup).first()
    if obj is None:
        raise NotFound()
    return obj


# Categories ------------------------------------------------------------------
def list_categories(*, include_archived: bool = False) -> QuerySet[CriterionCategory]:
    qs = CriterionCategory.objects.all()
    return qs if include_archived else qs.filter(is_archived=False)


def get_category(*, pk: int) -> CriterionCategory:
    return _get(CriterionCategory.objects.all(), pk=pk)


# Criteria --------------------------------------------------------------------
def list_criteria(*, include_archived: bool = False) -> QuerySet[RatingCriterion]:
    qs = RatingCriterion.objects.select_related("category", "current_version")
    return qs if include_archived else qs.filter(is_archived=False)


def get_criterion(*, public_id: UUID | str) -> RatingCriterion:
    return _get(list_criteria(include_archived=True), public_id=public_id)


def list_criterion_versions(*, criterion: RatingCriterion) -> QuerySet[CriterionVersion]:
    return criterion.versions.order_by("-version")


# Form versions ----------------------------------------------------------------
def _items_prefetch() -> Prefetch:
    return Prefetch(
        "items",
        queryset=FormVersionItem.objects.select_related("criterion_version__criterion").order_by(
            "order"
        ),
    )


def list_form_versions() -> QuerySet[FormVersion]:
    return FormVersion.objects.prefetch_related(_items_prefetch())


def get_form_version(*, public_id: UUID | str) -> FormVersion:
    return _get(list_form_versions(), public_id=public_id)


def list_published_forms() -> QuerySet[FormVersion]:
    return list_form_versions().filter(status=FormStatus.PUBLISHED)


# Cycles ----------------------------------------------------------------------
def list_cycles() -> QuerySet[EvaluationCycle]:
    return EvaluationCycle.objects.select_related("form_version")


def get_cycle(*, public_id: UUID | str) -> EvaluationCycle:
    return _get(list_cycles(), public_id=public_id)


def get_open_cycle() -> EvaluationCycle | None:
    """The cycle currently OPEN (at most one, enforced by the database)."""
    return (
        EvaluationCycle.objects.select_related("form_version")
        .prefetch_related(Prefetch("form_version__items", queryset=_items_prefetch().queryset))
        .filter(status=CycleStatus.OPEN)
        .first()
    )


def get_member_cycle(*, public_id: UUID | str) -> EvaluationCycle:
    """A cycle as members may see it: drafts are invisible."""
    return _get(
        list_cycles()
        .exclude(status=CycleStatus.DRAFT)
        .prefetch_related(Prefetch("form_version__items", queryset=_items_prefetch().queryset)),
        public_id=public_id,
    )


# Submissions (author view) ------------------------------------------------------
def get_eligibility(*, viewer, recipient_public_id: UUID | str) -> rules.Eligibility:
    """MEM-04 / BR-14 hint for the UI. Inactive or unknown recipients → 404."""
    recipient_profile = member_selectors.get_member_profile(public_id=recipient_public_id)
    return rules.eligibility(
        evaluator=viewer, recipient_profile=recipient_profile, cycle=get_open_cycle()
    )


def _my_evaluations(user) -> QuerySet[Evaluation]:
    return (
        Evaluation.objects.filter(evaluator=user, status=EvaluationStatus.SUBMITTED)
        .select_related("cycle", "recipient__member_profile__voice_section")
        .prefetch_related("ratings__criterion_version", "comments")
    )


def list_my_evaluations(*, user, cycle_public_id: UUID | str | None = None) -> QuerySet[Evaluation]:
    """MINE-01: the evaluations this user wrote (never anybody else's)."""
    qs = _my_evaluations(user)
    if cycle_public_id:
        qs = qs.filter(cycle__public_id=cycle_public_id)
    return qs.order_by("-submitted_at", "-id")


def get_my_evaluation(*, user, public_id: UUID | str) -> Evaluation:
    """Author-only. Anyone else (including the recipient) gets 404 (BR-02)."""
    return _get(_my_evaluations(user), public_id=public_id)


def count_my_evaluations(*, user, cycle: EvaluationCycle) -> int:
    return Evaluation.objects.filter(
        evaluator=user, cycle=cycle, status=EvaluationStatus.SUBMITTED
    ).count()


def count_members_left_to_evaluate(*, user, cycle: EvaluationCycle) -> int:
    """Members the user may still evaluate in ``cycle`` (dashboard)."""
    own = member_selectors.get_own_profile(user=user)
    if own is None:
        return 0
    candidates = member_selectors.active_profiles().filter(is_evaluable=True).exclude(user=user)
    if cycle.evaluation_scope == EvaluationScope.SAME_SECTION:
        candidates = candidates.filter(voice_section_id=own.voice_section_id)
    if not cycle.allow_resubmission:
        done = Evaluation.objects.filter(
            evaluator=user, cycle=cycle, status=EvaluationStatus.SUBMITTED
        ).values("recipient_id")
        candidates = candidates.exclude(user_id__in=done)
    return candidates.count()
