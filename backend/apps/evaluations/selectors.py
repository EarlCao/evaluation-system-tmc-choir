"""Public read API of the evaluations module."""

from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet

from apps.core.exceptions import NotFound
from apps.members import selectors as member_selectors

from . import rules
from .constants import (
    CycleStatus,
    EvaluationScope,
    EvaluationStatus,
    FeedbackVisibility,
    FormStatus,
    ModerationStatus,
)
from .models import (
    CriterionCategory,
    CriterionVersion,
    Evaluation,
    EvaluationComment,
    EvaluationCycle,
    EvaluationRating,
    EvaluationRevision,
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


def list_my_revisions(*, user, public_id: UUID | str) -> QuerySet[EvaluationRevision]:
    """MINE-04: revision history, for the author only (others get 404)."""
    evaluation = get_my_evaluation(user=user, public_id=public_id)
    return evaluation.revisions.order_by("revision_number")


# Recipient-facing rows (consumed ONLY by apps.feedback) -------------------------------
# Privacy Model: every query below uses an explicit .values() whitelist. None of them
# selects or joins the evaluator. Do not add evaluator columns here.
FEEDBACK_ROW_FIELDS = ("id", "cycle_id", "submitted_at", "is_edited")


def _visible_received(recipient) -> QuerySet[Evaluation]:
    return (
        Evaluation.objects.filter(recipient=recipient, status=EvaluationStatus.SUBMITTED)
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .exclude(cycle__status=CycleStatus.DRAFT)
        # AFTER_CLOSE cycles release feedback only once closed (Q4, Privacy Model).
        .exclude(
            Q(cycle__feedback_visibility=FeedbackVisibility.AFTER_CLOSE)
            & Q(cycle__status=CycleStatus.OPEN)
        )
    )


def received_feedback_rows(*, recipient, cycle_public_id=None) -> list[dict]:
    """Visible evaluations about ``recipient``: id, cycle_id, submitted_at, is_edited only."""
    qs = _visible_received(recipient)
    if cycle_public_id is not None:
        qs = qs.filter(cycle__public_id=cycle_public_id)
    return list(qs.values(*FEEDBACK_ROW_FIELDS))


def received_comment_rows(*, evaluation_ids) -> list[dict]:
    """Visible comment/suggestion texts: evaluation_id, kind, body."""
    return list(
        EvaluationComment.objects.filter(evaluation_id__in=evaluation_ids)
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .values("evaluation_id", "kind", "body")
    )


def received_rating_rows(*, evaluation_ids) -> list[dict]:
    """Ratings: evaluation_id, criterion_version_id, value (NULL = not rated)."""
    return list(
        EvaluationRating.objects.filter(evaluation_id__in=evaluation_ids).values(
            "evaluation_id", "criterion_version_id", "value"
        )
    )


def criterion_versions_info(*, ids) -> dict[int, dict]:
    rows = CriterionVersion.objects.filter(pk__in=ids).values(
        "id",
        "name",
        "scale_type",
        "min_value",
        "max_value",
        "step",
        "criterion__public_id",
        "criterion__sort_order",
    )
    return {row["id"]: row for row in rows}


def cycles_info(*, ids) -> dict[int, dict]:
    rows = EvaluationCycle.objects.filter(pk__in=ids).values(
        "id", "public_id", "name", "starts_at", "status"
    )
    return {row["id"]: row for row in rows}


# Admin statistics (ADM-01) ----------------------------------------------------------------
def count_cycles_by_status() -> dict[str, int]:
    # .order_by() clears Meta.ordering, which would otherwise join the GROUP BY.
    counts = dict(EvaluationCycle.objects.order_by().values_list("status").annotate(n=Count("id")))
    return {status: counts.get(status, 0) for status in CycleStatus.values}


def count_submitted_evaluations(*, cycle: EvaluationCycle | None = None) -> int:
    qs = Evaluation.objects.filter(status=EvaluationStatus.SUBMITTED)
    return qs.filter(cycle=cycle).count() if cycle else qs.count()


def cycle_participation(*, cycle: EvaluationCycle) -> dict:
    """Distinct submitted pairs vs pairs possible under the cycle's scope (self excluded).
    Members who are inactive now are not counted on either side."""
    profiles = list(
        member_selectors.active_profiles().values("user_id", "voice_section_id", "is_evaluable")
    )
    by_section: dict[int, list[dict]] = {}
    for p in profiles:
        by_section.setdefault(p["voice_section_id"], []).append(p)

    def pairs(group: list[dict]) -> int:
        evaluators = len(group)
        recipients = sum(1 for p in group if p["is_evaluable"])
        return evaluators * recipients - recipients  # minus evaluating yourself

    possible = (
        sum(pairs(g) for g in by_section.values())
        if cycle.evaluation_scope == EvaluationScope.SAME_SECTION
        else pairs(profiles)
    )
    active_ids = {p["user_id"] for p in profiles}
    submitted_pairs = {
        (e, r)
        for e, r in Evaluation.objects.filter(
            cycle=cycle, status=EvaluationStatus.SUBMITTED
        ).values_list("evaluator_id", "recipient_id")
        if e in active_ids and r in active_ids
    }
    return {
        "possible_pairs": possible,
        "submitted_pairs": min(len(submitted_pairs), possible),
        "participating_members": len({e for e, _ in submitted_pairs}),
        "participation_percent": (
            round(len(submitted_pairs) / possible * 100, 1) if possible else None
        ),
    }
