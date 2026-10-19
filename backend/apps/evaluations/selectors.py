"""Public read API of the evaluations module."""

from uuid import UUID

from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q, QuerySet

from apps.accounts.constants import UserRole
from apps.core.exceptions import NotFound
from apps.members import selectors as member_selectors

from . import rules
from .constants import (
    CommentKind,
    CycleStatus,
    EvaluationScope,
    EvaluationStatus,
    FeedbackVisibility,
    FormStatus,
    ModerationStatus,
)
from .defaults import DEFAULT_COMMENT_PROMPTS
from .models import (
    CommentPrompt,
    CriterionCategory,
    CriterionVersion,
    Evaluation,
    EvaluationComment,
    EvaluationCycle,
    EvaluationRating,
    EvaluationRevision,
    FormVersion,
    FormVersionItem,
    ModerationAction,
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


# Comment prompts -------------------------------------------------------------
def ensure_default_comment_prompts() -> None:
    existing_keys = set(CommentPrompt.objects.values_list("key", flat=True))
    if not existing_keys or existing_keys <= {"comment", "suggestion"}:
        for i, p in enumerate(DEFAULT_COMMENT_PROMPTS, start=1):
            CommentPrompt.objects.get_or_create(
                key=p["key"],
                defaults={
                    "label": p["label"],
                    "is_required": p["is_required"],
                    "sort_order": i,
                },
            )


def list_comment_prompts(*, include_archived: bool = False) -> QuerySet[CommentPrompt]:
    ensure_default_comment_prompts()
    qs = CommentPrompt.objects.all()
    return qs if include_archived else qs.filter(is_archived=False)


def get_comment_prompt(*, public_id: UUID | str) -> CommentPrompt:
    ensure_default_comment_prompts()
    return _get(CommentPrompt.objects.all(), public_id=public_id)


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
        .select_related("cycle", "form_version", "recipient__member_profile__voice_section")
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


def get_public_self_evaluation(*, user) -> dict | None:
    """Latest visible self-evaluation (evaluator == recipient == user) for public display."""
    evaluation = (
        Evaluation.objects.filter(
            evaluator=user,
            recipient=user,
            status=EvaluationStatus.SUBMITTED,
        )
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .exclude(cycle__status=CycleStatus.DRAFT)
        .select_related("cycle", "form_version")
        .prefetch_related("ratings__criterion_version", "comments")
        .order_by("-cycle__is_current", "-submitted_at", "-id")
        .first()
    )
    if evaluation is None:
        return None
    prompts_by_key = {
        p["key"]: p["label"] for p in evaluation.form_version.effective_comment_prompts
    }
    visible_comments = [
        c for c in evaluation.comments.all() if c.moderation_status != ModerationStatus.HIDDEN
    ]
    by_kind = {c.kind: c for c in visible_comments}
    comments_list = []
    for c in visible_comments:
        key = (
            "comment"
            if c.kind == CommentKind.COMMENT
            else ("suggestion" if c.kind == CommentKind.SUGGESTION else c.kind)
        )
        label = c.label or prompts_by_key.get(key) or key
        comments_list.append({"key": key, "label": label, "body": c.body})
    return {
        "public_id": str(evaluation.public_id),
        "cycle": {
            "public_id": str(evaluation.cycle.public_id),
            "name": evaluation.cycle.name,
        },
        "submitted_at": evaluation.submitted_at.isoformat(),
        "is_edited": evaluation.is_edited,
        "ratings": [
            {
                "criterion_version": r.criterion_version_id,
                "criterion_name": r.criterion_version.name,
                "value": float(r.value) if r.value is not None else None,
                "label": r.label,
                "min_value": float(r.criterion_version.min_value),
                "max_value": float(r.criterion_version.max_value),
            }
            for r in evaluation.ratings.all()
        ],
        "comment": by_kind[CommentKind.COMMENT].body if CommentKind.COMMENT in by_kind else "",
        "suggestion": (
            by_kind[CommentKind.SUGGESTION].body if CommentKind.SUGGESTION in by_kind else ""
        ),
        "comments": comments_list,
    }


def _visible_received(recipient) -> QuerySet[Evaluation]:
    return (
        Evaluation.objects.filter(recipient=recipient, status=EvaluationStatus.SUBMITTED)
        .exclude(evaluator=F("recipient"))
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
    """Visible comment/suggestion texts: evaluation_id, kind, label, order, body."""
    return list(
        EvaluationComment.objects.filter(evaluation_id__in=evaluation_ids)
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .order_by("order", "id")
        .values("evaluation_id", "kind", "label", "order", "body")
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
        "version",
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


def participation_by_member(*, cycle: EvaluationCycle) -> dict[int, dict]:
    """Per currently active member (by user id): ``possible`` = members they may evaluate under
    the cycle's scope (self excluded; Super Admins never evaluate, Q9), ``given`` = distinct
    members they evaluated, ``received`` = distinct members who evaluated them. Members who are
    inactive now are not counted on either side; resubmissions count once (REP-04)."""
    profiles = list(
        member_selectors.active_profiles().values(
            "user_id", "voice_section_id", "is_evaluable", "user__role"
        )
    )
    groups: dict[int | None, list[dict]] = {}
    for p in profiles:
        key = (
            p["voice_section_id"]
            if cycle.evaluation_scope == EvaluationScope.SAME_SECTION
            else None
        )
        groups.setdefault(key, []).append(p)
    result = {p["user_id"]: {"possible": 0, "given": 0, "received": 0} for p in profiles}
    for group in groups.values():
        recipients = sum(1 for p in group if p["is_evaluable"])
        for p in group:
            if p["user__role"] != UserRole.SUPER_ADMIN:
                result[p["user_id"]]["possible"] = recipients - (1 if p["is_evaluable"] else 0)
    pairs = {
        (e, r)
        for e, r in Evaluation.objects.filter(
            cycle=cycle, status=EvaluationStatus.SUBMITTED
        ).values_list("evaluator_id", "recipient_id")
        if e in result and r in result
    }
    for e, r in pairs:
        result[e]["given"] += 1
        result[r]["received"] += 1
    return result


def cycle_participation(*, cycle: EvaluationCycle) -> dict:
    """Distinct submitted pairs vs pairs possible under the cycle's scope (self excluded)."""
    per_member = participation_by_member(cycle=cycle).values()
    possible = sum(m["possible"] for m in per_member)
    submitted = sum(m["given"] for m in per_member)
    return {
        "possible_pairs": possible,
        "submitted_pairs": min(submitted, possible),
        "participating_members": sum(1 for m in per_member if m["given"]),
        "participation_percent": round(submitted / possible * 100, 1) if possible else None,
    }


# Report rows (consumed by apps.reports, Super Admin only) ---------------------------------
REPORT_ROW_FIELDS = (
    "id",
    "evaluator_id",
    "recipient_id",
    "cycle_id",
    "submitted_at",
    "recipient__member_profile__voice_section_id",
)


def report_evaluation_rows(
    *,
    cycle: str = "",
    submitted_from=None,
    submitted_to=None,
    recipient=None,
    evaluator=None,
    voice_section: int | None = None,
) -> list[dict]:
    """Submitted, not-hidden evaluations for aggregate reports. Hidden evaluations are left
    out so that reports agree with what members see (ADM-05). Ids only, no content."""
    qs = Evaluation.objects.filter(status=EvaluationStatus.SUBMITTED).exclude(
        moderation_status=ModerationStatus.HIDDEN
    )
    if cycle:
        qs = qs.filter(cycle__public_id=cycle)
    if submitted_from:
        qs = qs.filter(submitted_at__date__gte=submitted_from)
    if submitted_to:
        qs = qs.filter(submitted_at__date__lte=submitted_to)
    if recipient is not None:
        qs = qs.filter(recipient=recipient)
    if evaluator is not None:
        qs = qs.filter(evaluator=evaluator)
    if voice_section:
        qs = qs.filter(recipient__member_profile__voice_section_id=voice_section)
    return list(qs.order_by().values(*REPORT_ROW_FIELDS))


# Super Admin browser (ADM-02/03/05) -----------------------------------------------------
# These are the ONLY reads that join evaluator identities. Callers must log the access
# (services.record_identity_access); the API layer does so on every request.
def _admin_evaluations() -> QuerySet[Evaluation]:
    flagged_text = EvaluationComment.objects.filter(
        evaluation=OuterRef("pk"), moderation_status=ModerationStatus.FLAGGED
    )
    return (
        Evaluation.objects.filter(status=EvaluationStatus.SUBMITTED)
        .select_related(
            "cycle",
            "form_version",
            "evaluator__member_profile__voice_section",
            "recipient__member_profile__voice_section",
        )
        .prefetch_related("ratings__criterion_version__criterion", "comments")
        .annotate(has_flagged_text=Exists(flagged_text))
    )


def admin_list_evaluations(
    *,
    recipient: str = "",
    evaluator: str = "",
    cycle: str = "",
    criterion: str = "",
    rating_min=None,
    rating_max=None,
    submitted_from=None,
    submitted_to=None,
    moderation: str = "",
    edited: bool | None = None,
) -> QuerySet[Evaluation]:
    """All submitted evaluations, newest first. ``recipient``/``evaluator``/``cycle``/
    ``criterion`` are public ids. Rating bounds apply to ``criterion`` when given, otherwise
    to any rating. ``moderation``: VISIBLE / FLAGGED / HIDDEN, or ``attention`` for anything
    flagged (the evaluation or one of its texts)."""
    qs = _admin_evaluations()
    if recipient:
        qs = qs.filter(recipient__public_id=recipient)
    if evaluator:
        qs = qs.filter(evaluator__public_id=evaluator)
    if cycle:
        qs = qs.filter(cycle__public_id=cycle)
    if submitted_from:
        qs = qs.filter(submitted_at__date__gte=submitted_from)
    if submitted_to:
        qs = qs.filter(submitted_at__date__lte=submitted_to)
    if edited is not None:
        qs = qs.filter(is_edited=edited)
    if moderation == "attention":
        qs = qs.filter(Q(moderation_status=ModerationStatus.FLAGGED) | Q(has_flagged_text=True))
    elif moderation:
        qs = qs.filter(moderation_status=moderation)
    if criterion or rating_min is not None or rating_max is not None:
        ratings = EvaluationRating.objects.filter(evaluation=OuterRef("pk"))
        if criterion:
            ratings = ratings.filter(criterion_version__criterion__public_id=criterion)
        if rating_min is not None:
            ratings = ratings.filter(value__gte=rating_min)
        if rating_max is not None:
            ratings = ratings.filter(value__lte=rating_max)
        qs = qs.filter(Exists(ratings))
    return qs.order_by("-submitted_at", "-id")


def admin_get_evaluation(*, public_id: UUID | str) -> Evaluation:
    return _get(
        _admin_evaluations().prefetch_related(
            Prefetch(
                "moderation_actions",
                queryset=ModerationAction.objects.select_related("actor").order_by(
                    "-created_at", "-id"
                ),
            )
        ),
        public_id=public_id,
    )


def admin_list_revisions(*, evaluation: Evaluation) -> QuerySet[EvaluationRevision]:
    """Revision history including the editor (members never see the editor)."""
    return evaluation.revisions.select_related("editor").order_by("revision_number")


def moderation_queue() -> QuerySet[Evaluation]:
    """Evaluations that need a moderator: the evaluation or one of its texts is flagged."""
    return admin_list_evaluations(moderation="attention").order_by("submitted_at", "id")


def count_needing_moderation() -> int:
    return moderation_queue().count()
