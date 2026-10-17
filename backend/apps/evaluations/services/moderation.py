"""Moderation (step 4.4: ADM-05, BR-17). Never deletes: changes visibility, appends history."""

from django.db import transaction

from apps.audit import services as audit
from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, ValidationError

from .. import events
from ..constants import CommentKind, ModerationStatus, ModerationTarget
from ..constants import ModerationAction as Action
from ..models import Evaluation, EvaluationComment, ModerationAction

NEXT_STATUS = {
    Action.FLAG: ModerationStatus.FLAGGED,
    Action.HIDE: ModerationStatus.HIDDEN,
    Action.RESTORE: ModerationStatus.VISIBLE,
}
REASON_MAX = 300


def moderate(
    *, actor, evaluation: Evaluation, action: str, target: str, reason: str = ""
) -> Evaluation:
    """Flag, hide or restore a whole evaluation, its comment or its suggestion.

    Hidden content disappears from the recipient's feedback immediately (feedback selectors);
    flagged content stays visible until it is hidden. A reason is required to flag or hide.
    """
    if action not in Action.values:
        raise ValidationError(fields={"action": ["Choose flag, hide or restore."]})
    if target not in ModerationTarget.values:
        raise ValidationError(fields={"target": ["Choose what to moderate."]})
    reason = reason.strip()
    if action in (Action.FLAG, Action.HIDE) and not reason:
        raise ValidationError(
            fields={"reason": ["Say why (it is kept in the moderation history)."]}
        )
    if len(reason) > REASON_MAX:
        raise ValidationError(fields={"reason": [f"Keep it under {REASON_MAX} characters."]})

    with transaction.atomic():
        locked = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
        if target == ModerationTarget.EVALUATION:
            subject = locked
        else:
            kind = (
                CommentKind.COMMENT
                if target == ModerationTarget.COMMENT
                else CommentKind.SUGGESTION
            )
            subject = EvaluationComment.objects.filter(evaluation=locked, kind=kind).first()
            if subject is None:
                raise BusinessRuleViolation("This evaluation has no such text to moderate.")
        before, after = subject.moderation_status, NEXT_STATUS[Action(action)]
        if before == after:
            raise BusinessRuleViolation(f"It is already {after.lower()}.")
        type(subject).objects.filter(pk=subject.pk).update(moderation_status=after)
        ModerationAction.objects.create(
            evaluation=locked, target=target, action=action, reason=reason, actor=actor
        )
        publish(
            events.EvaluationModerated(
                actor_id=actor.pk,
                target_id=str(locked.public_id),
                action=action,
                moderation_target=target,
                changes=(("moderation_status", before, after),),
                reason=reason,
            )
        )
    locked.refresh_from_db()
    return locked


SENSITIVE_ACCESS = "admin.sensitive_access"


def record_identity_access(*, actor, view: str, evaluation: Evaluation | None = None, **details):
    """ADM-03: every Super Admin read that reveals who wrote an evaluation is logged. Written
    synchronously (not via an event) so the read fails if it cannot be audited."""
    audit.record(
        event_type=SENSITIVE_ACCESS,
        actor=actor,
        target_type="evaluations.Evaluation" if evaluation else "",
        target_id=str(evaluation.public_id) if evaluation else None,
        metadata={"view": view, **details},
    )
