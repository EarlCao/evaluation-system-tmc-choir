"""Submission services: submit (2.3) and edit (3.1) evaluations; every change is a revision."""

from collections.abc import Sequence
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.members import selectors as member_selectors

from .. import events, rules, selectors
from ..constants import DEFAULT_TEXT_LIMIT, CommentKind, Ineligibility, ModerationStatus
from ..defaults import DEFAULT_COMMENT_PROMPTS
from ..models import (
    Evaluation,
    EvaluationComment,
    EvaluationRating,
    EvaluationRevision,
    FormVersion,
)
from ..scales import is_valid_value, point_key
from ..text import clean_text


def _kind_for_key(key: str) -> str:
    if key == "comment":
        return CommentKind.COMMENT
    if key == "suggestion":
        return CommentKind.SUGGESTION
    return key


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


def _validated_texts(
    form: FormVersion,
    comment: str,
    suggestion: str,
    comments: dict[str, str] | None = None,
) -> dict[str, str]:
    """EVAL-05: optional/required per form, length limits enforced server-side."""
    raw_map = {str(k): str(v or "") for k, v in (comments or {}).items()}
    if comment or "comment" not in raw_map:
        raw_map["comment"] = raw_map.get("comment") or comment
    if suggestion or "suggestion" not in raw_map:
        raw_map["suggestion"] = raw_map.get("suggestion") or suggestion

    prompts = form.effective_comment_prompts
    if (
        prompts
        and prompts[0]["key"] != "comment"
        and comment
        and not raw_map.get(prompts[0]["key"])
    ):
        raw_map[prompts[0]["key"]] = comment
    if (
        len(prompts) > 1
        and prompts[1]["key"] != "suggestion"
        and suggestion
        and not raw_map.get(prompts[1]["key"])
    ):
        raw_map[prompts[1]["key"]] = suggestion

    texts = {k: clean_text(v) for k, v in raw_map.items()}
    texts.setdefault("comment", "")
    texts.setdefault("suggestion", "")

    errors: dict[str, list[str]] = {}
    for p in prompts:
        key = p["key"]
        texts.setdefault(key, "")
        required = bool(p["is_required"])
        limit = (
            form.comment_max_length
            if key == "comment"
            else (form.suggestion_max_length if key == "suggestion" else DEFAULT_TEXT_LIMIT)
        )
        if required and not texts[key]:
            errors[key] = ["This field is required."]
        elif len(texts[key]) > limit:
            errors[key] = [f"Keep it under {limit} characters."]

    if prompts and prompts[0]["key"] != "comment" and not texts["comment"]:
        texts["comment"] = texts.get(prompts[0]["key"], "")
    if len(prompts) > 1 and prompts[1]["key"] != "suggestion" and not texts["suggestion"]:
        texts["suggestion"] = texts.get(prompts[1]["key"], "")

    if errors:
        raise ValidationError(fields=errors)
    return texts


def validated_content(
    form: FormVersion,
    ratings: Sequence[dict],
    comment: str,
    suggestion: str,
    comments: dict[str, str] | None = None,
):
    """Validate ratings and texts together so every problem is reported at once."""
    errors: dict = {}
    checked_ratings, texts = None, None
    try:
        checked_ratings = _validated_ratings(form, ratings)
    except ValidationError as exc:
        errors.update(exc.fields or {})
    try:
        texts = _validated_texts(form, comment, suggestion, comments=comments)
    except ValidationError as exc:
        errors.update(exc.fields or {})
    if errors:
        raise ValidationError(fields=errors)
    return checked_ratings, texts


def build_snapshot(*, evaluation: Evaluation, ratings, texts: dict[str, str]) -> dict:
    """Full content of one revision (MINE-03/04)."""
    snap: dict = {
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
        "comment": texts.get("comment", ""),
        "suggestion": texts.get("suggestion", ""),
    }
    extra_keys = [
        k for k, v in texts.items() if k not in ("comment", "suggestion") and v
    ]
    if extra_keys:
        snap["comments"] = {k: v for k, v in texts.items() if v}
    return snap


def write_content(*, evaluation: Evaluation, ratings, texts: dict[str, str]) -> None:
    """(Re)write the current ratings and texts of an evaluation. Comment moderation status
    is carried over per kind, so editing can never un-hide moderated text (ADM-05)."""
    previous_status = dict(evaluation.comments.values_list("kind", "moderation_status"))
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
    prompts = evaluation.form_version.effective_comment_prompts
    default_labels = {p["key"]: p["label"] for p in DEFAULT_COMMENT_PROMPTS}
    rows_to_create: list[EvaluationComment] = []
    seen_kinds: set[str] = set()
    for order, p in enumerate(prompts, start=1):
        key = p["key"]
        body = texts.get(key, "")
        kind = _kind_for_key(key)
        seen_kinds.add(kind)
        if body:
            rows_to_create.append(
                EvaluationComment(
                    evaluation=evaluation,
                    kind=kind,
                    label=p["label"],
                    order=order,
                    body=body,
                    moderation_status=previous_status.get(kind, ModerationStatus.VISIBLE),
                )
            )
    next_order = len(prompts) + 1
    for kind, field, default_label in (
        (CommentKind.COMMENT, "comment", "Comments (Unsay imong ikaingon sa akoa?)"),
        (CommentKind.SUGGESTION, "suggestion", "Suggestions (Unsay imong ikasuggest sa akoa?)"),
    ):
        if kind not in seen_kinds and texts.get(field):
            seen_kinds.add(kind)
            rows_to_create.append(
                EvaluationComment(
                    evaluation=evaluation,
                    kind=kind,
                    label=default_label,
                    order=next_order,
                    body=texts[field],
                    moderation_status=previous_status.get(kind, ModerationStatus.VISIBLE),
                )
            )
            next_order += 1
    for key, body in texts.items():
        kind = _kind_for_key(key)
        if kind not in seen_kinds and body:
            seen_kinds.add(kind)
            label = default_labels.get(key) or f"Additional comment ({key.replace('_', ' ')})"
            rows_to_create.append(
                EvaluationComment(
                    evaluation=evaluation,
                    kind=kind,
                    label=label[:200],
                    order=next_order,
                    body=body,
                    moderation_status=previous_status.get(kind, ModerationStatus.VISIBLE),
                )
            )
            next_order += 1
    EvaluationComment.objects.bulk_create(rows_to_create)


def submit_evaluation(
    *,
    evaluator,
    recipient_public_id,
    ratings: Sequence[dict],
    comment: str = "",
    suggestion: str = "",
    comments: dict[str, str] | None = None,
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
    checked_ratings, texts = validated_content(
        form, ratings, comment, suggestion, comments=comments
    )
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
                    feedback_visibility=cycle.feedback_visibility,
                )
            )
    except IntegrityError as exc:  # lost a race with a duplicate submission (BR-12)
        raise BusinessRuleViolation(Ineligibility.ALREADY_EVALUATED.label) from exc
    return evaluation


CHANGE_SUMMARY_MAX = 200


def edit_evaluation(
    *,
    editor,
    evaluation_public_id,
    ratings: Sequence[dict],
    comment: str = "",
    suggestion: str = "",
    comments: dict[str, str] | None = None,
    change_summary: str = "",
) -> Evaluation:
    """MINE-02 / MINE-03 / BR-05: the author edits within the window; every real change writes
    the next immutable revision. Identical content is a no-op (no revision)."""
    evaluation = selectors.get_my_evaluation(user=editor, public_id=evaluation_public_id)
    if not rules.can_edit(evaluation):
        raise BusinessRuleViolation("The edit window for this evaluation has closed.")
    summary = clean_text(change_summary)
    if len(summary) > CHANGE_SUMMARY_MAX:
        raise ValidationError(
            fields={"change_summary": [f"Keep it under {CHANGE_SUMMARY_MAX} characters."]}
        )
    # Validate against the form the evaluation was submitted with (BR-07).
    checked_ratings, texts = validated_content(
        evaluation.form_version, ratings, comment, suggestion, comments=comments
    )

    with transaction.atomic():
        locked = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
        latest = locked.revisions.order_by("-revision_number").first()
        snapshot = build_snapshot(evaluation=locked, ratings=checked_ratings, texts=texts)
        if latest is not None and latest.snapshot == snapshot:
            return evaluation
        number = locked.current_revision_number + 1
        write_content(evaluation=locked, ratings=checked_ratings, texts=texts)
        EvaluationRevision.objects.create(
            evaluation=locked,
            revision_number=number,
            snapshot=snapshot,
            editor=editor,
            change_summary=summary or "Edited",
        )
        Evaluation.objects.filter(pk=locked.pk).update(
            current_revision_number=number,
            is_edited=True,
            last_edited_at=timezone.now(),
            updated_at=timezone.now(),
        )
        publish(
            events.EvaluationEdited(
                actor_id=editor.pk, target_id=str(locked.public_id), revision_number=number
            )
        )
    return selectors.get_my_evaluation(user=editor, public_id=evaluation_public_id)
