"""Submission services (step 2.3): submit an evaluation, write revision 1."""

from collections.abc import Sequence
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.members import selectors as member_selectors

from .. import events, rules, selectors
from ..constants import CommentKind, Ineligibility
from ..models import (
    Evaluation,
    EvaluationComment,
    EvaluationRating,
    EvaluationRevision,
    FormVersion,
)
from ..scales import is_valid_value, point_key
from ..text import clean_text


def _validated_ratings(
    form: FormVersion, ratings: Sequence[dict]
) -> list[tuple[object, Decimal | None]]:
    """EVAL-07: every required criterion rated, values on the scale, nothing extra."""
    items = {item.criterion_version_id: item.criterion_version for item in form.items.all()}
    errors: dict[str, list[str]] = {}
    given: dict[int, Decimal | None] = {}
    for entry in ratings:
        try:
            cv_id = int(entry.get("criterion_version"))
        except (TypeError, ValueError):
            errors.setdefault("unknown", []).append("Each rating needs a criterion_version.")
            continue
        if cv_id not in items:
            errors[str(cv_id)] = ["This criterion is not part of the form."]
            continue
        if cv_id in given:
            errors[str(cv_id)] = ["Rate each criterion once."]
            continue
        raw = entry.get("value")
        if raw is None or raw == "":
            given[cv_id] = None
            continue
        try:
            value = Decimal(str(raw))
        except (InvalidOperation, ValueError):
            errors[str(cv_id)] = ["Enter a number."]
            continue
        cv = items[cv_id]
        if not value.is_finite() or not is_valid_value(
            value=value, min_value=cv.min_value, max_value=cv.max_value, step=cv.step
        ):
            errors[str(cv_id)] = [
                f"Choose a value from {point_key(cv.min_value)} to {point_key(cv.max_value)}"
                f" in steps of {point_key(cv.step)}."
            ]
            continue
        given[cv_id] = value
    for cv_id, cv in items.items():
        if cv.is_required and given.get(cv_id) is None and str(cv_id) not in errors:
            errors[str(cv_id)] = [f"Rate “{cv.name}”."]
    if errors:
        raise ValidationError(fields={"ratings": errors})
    return [(items[cv_id], given.get(cv_id)) for cv_id in items]


def _validated_texts(form: FormVersion, comment: str, suggestion: str) -> dict[str, str]:
    """EVAL-05: optional/required per form, length limits enforced server-side."""
    texts = {"comment": clean_text(comment), "suggestion": clean_text(suggestion)}
    rules_ = {
        "comment": (form.comment_required, form.comment_max_length),
        "suggestion": (form.suggestion_required, form.suggestion_max_length),
    }
    errors = {}
    for field, (required, limit) in rules_.items():
        if required and not texts[field]:
            errors[field] = ["This field is required."]
        elif len(texts[field]) > limit:
            errors[field] = [f"Keep it under {limit} characters."]
    if errors:
        raise ValidationError(fields=errors)
    return texts


def validated_content(form: FormVersion, ratings: Sequence[dict], comment: str, suggestion: str):
    """Validate ratings and texts together so every problem is reported at once."""
    errors: dict = {}
    checked_ratings, texts = None, None
    try:
        checked_ratings = _validated_ratings(form, ratings)
    except ValidationError as exc:
        errors.update(exc.fields or {})
    try:
        texts = _validated_texts(form, comment, suggestion)
    except ValidationError as exc:
        errors.update(exc.fields or {})
    if errors:
        raise ValidationError(fields=errors)
    return checked_ratings, texts


def build_snapshot(*, evaluation: Evaluation, ratings, texts: dict[str, str]) -> dict:
    """Full content of one revision (MINE-03/04)."""
    return {
        "form_version_id": evaluation.form_version_id,
        "ratings": [
            {
                "criterion_version_id": cv.pk,
                "criterion": cv.name,
                "value": None if value is None else point_key(value),
                "label": "" if value is None else cv.labels.get(point_key(value), ""),
            }
            for cv, value in ratings
        ],
        "comment": texts["comment"],
        "suggestion": texts["suggestion"],
    }


def write_content(*, evaluation: Evaluation, ratings, texts: dict[str, str]) -> None:
    """(Re)write the current ratings and texts of an evaluation."""
    evaluation.ratings.all().delete()
    EvaluationRating.objects.bulk_create(
        EvaluationRating(
            evaluation=evaluation,
            criterion_version=cv,
            value=value,
            label="" if value is None else cv.labels.get(point_key(value), ""),
        )
        for cv, value in ratings
    )
    evaluation.comments.all().delete()
    EvaluationComment.objects.bulk_create(
        EvaluationComment(evaluation=evaluation, kind=kind, body=texts[field])
        for kind, field in (
            (CommentKind.COMMENT, "comment"),
            (CommentKind.SUGGESTION, "suggestion"),
        )
        if texts[field]
    )


def submit_evaluation(
    *,
    evaluator,
    recipient_public_id,
    ratings: Sequence[dict],
    comment: str = "",
    suggestion: str = "",
) -> Evaluation:
    """EVAL-01, EVAL-05, EVAL-07, EVAL-08, BR-01, BR-12, BR-13, BR-14, BR-05 (revision 1)."""
    cycle = selectors.get_open_cycle()
    recipient_profile = member_selectors.get_member_profile(public_id=recipient_public_id)
    verdict = rules.eligibility(
        evaluator=evaluator, recipient_profile=recipient_profile, cycle=cycle
    )
    if not verdict.can_evaluate:
        raise BusinessRuleViolation(verdict.message)

    form = cycle.form_version
    checked_ratings, texts = validated_content(form, ratings, comment, suggestion)
    now = timezone.now()
    try:
        with transaction.atomic():
            previous = (
                Evaluation.objects.filter(
                    cycle=cycle, evaluator=evaluator, recipient_id=recipient_profile.user_id
                ).aggregate(m=Max("submission_number"))["m"]
                or 0
            )
            evaluation = Evaluation.objects.create(
                cycle=cycle,
                evaluator=evaluator,
                recipient_id=recipient_profile.user_id,
                form_version=form,
                submission_number=previous + 1,
                submitted_at=now,
            )
            write_content(evaluation=evaluation, ratings=checked_ratings, texts=texts)
            EvaluationRevision.objects.create(
                evaluation=evaluation,
                revision_number=1,
                snapshot=build_snapshot(
                    evaluation=evaluation, ratings=checked_ratings, texts=texts
                ),
                editor=evaluator,
                change_summary="Submitted",
            )
            publish(
                events.EvaluationSubmitted(
                    actor_id=evaluator.pk,
                    target_id=str(evaluation.public_id),
                    recipient_id=recipient_profile.user_id,
                    cycle_id=cycle.pk,
                )
            )
    except IntegrityError as exc:  # lost a race with a duplicate submission (BR-12)
        raise BusinessRuleViolation(Ineligibility.ALREADY_EVALUATED.label) from exc
    return evaluation
