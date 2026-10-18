"""Configuration services (step 2.2): categories, criteria + versions, forms, cycles."""

from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import IntegrityError, models, transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify

from apps.audit import services as audit_services
from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.system.selectors import get_settings

from .. import events
from ..constants import (
    CRITERION_DESCRIPTION_MAX,
    CRITERION_NAME_MAX,
    TEXT_LIMIT_MAX,
    CycleStatus,
    EvaluationScope,
    FeedbackVisibility,
    FormStatus,
)
from ..models import (
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
from ..scales import normalize_labels, validate_scale

VERSION_FIELDS = (
    "name",
    "description",
    "scale_type",
    "min_value",
    "max_value",
    "step",
    "labels",
    "is_required",
)


def _pk(user) -> int | None:
    return getattr(user, "pk", None)


# ---------------------------------------------------------------------------
# Categories (CFG-01)
# ---------------------------------------------------------------------------
def create_category(*, actor, name: str) -> CriterionCategory:
    name = name.strip()
    if not name:
        raise ValidationError(fields={"name": ["Enter a name."]})
    if CriterionCategory.objects.filter(name__iexact=name).exists():
        raise ValidationError(fields={"name": ["A category with this name exists."]})
    order = (CriterionCategory.objects.aggregate(m=Max("sort_order"))["m"] or 0) + 1
    category = CriterionCategory.objects.create(name=name, sort_order=order)
    publish(events.CategoryChanged(actor_id=_pk(actor), target_id=category.pk, action="created"))
    return category


def update_category(*, actor, category: CriterionCategory, **changes) -> CriterionCategory:
    allowed = {"name", "sort_order", "is_archived"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValidationError(
            fields={f: ["This field cannot be changed."] for f in sorted(unknown)}
        )
    if "name" in changes:
        changes["name"] = str(changes["name"]).strip()
        clash = CriterionCategory.objects.filter(name__iexact=changes["name"]).exclude(
            pk=category.pk
        )
        if not changes["name"] or clash.exists():
            raise ValidationError(fields={"name": ["Enter a unique name."]})
    diff = tuple(
        (f, getattr(category, f), v)
        for f, v in sorted(changes.items())
        if getattr(category, f) != v
    )
    if diff:
        for field, _old, new in diff:
            setattr(category, field, new)
        category.save()
        publish(
            events.CategoryChanged(
                actor_id=_pk(actor), target_id=category.pk, action="updated", changes=diff
            )
        )
    return category


# ---------------------------------------------------------------------------
# Criteria + versions (EVAL-02..04, CFG-01..03, BR-07)
# ---------------------------------------------------------------------------
def _clean_version_data(data: dict) -> dict:
    errors = validate_scale(
        scale_type=data.get("scale_type"),
        min_value=data.get("min_value"),
        max_value=data.get("max_value"),
        step=data.get("step"),
        labels=data.get("labels"),
    )
    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    if not name:
        errors["name"] = ["Enter a name."]
    elif len(name) > CRITERION_NAME_MAX:
        errors["name"] = [f"Keep it under {CRITERION_NAME_MAX} characters."]
    if len(description) > CRITERION_DESCRIPTION_MAX:
        errors["description"] = [f"Keep it under {CRITERION_DESCRIPTION_MAX} characters."]
    if errors:
        raise ValidationError(fields=errors)
    return {
        "name": name,
        "description": description,
        "scale_type": data["scale_type"],
        "min_value": Decimal(str(data["min_value"])),
        "max_value": Decimal(str(data["max_value"])),
        "step": Decimal(str(data["step"])),
        "labels": normalize_labels(data.get("labels")),
        "is_required": bool(data.get("is_required", True)),
    }


def _unique_key(base: str) -> str:
    key = slugify(base)[:50] or "criterion"
    candidate, n = key, 2
    while RatingCriterion.objects.filter(key=candidate).exists():
        candidate, n = f"{key}-{n}", n + 1
    return candidate


def _category(category_id: int | None) -> CriterionCategory | None:
    if category_id is None:
        return None
    category = CriterionCategory.objects.filter(pk=category_id, is_archived=False).first()
    if category is None:
        raise ValidationError(fields={"category": ["Choose an active category."]})
    return category


def create_criterion(*, actor, category_id: int | None = None, key: str = "", **version_data):
    """Create a criterion with version 1."""
    data = _clean_version_data(version_data)
    category = _category(category_id)
    with transaction.atomic():
        order = (RatingCriterion.objects.aggregate(m=Max("sort_order"))["m"] or 0) + 1
        criterion = RatingCriterion.objects.create(
            key=_unique_key(key or data["name"]), category=category, sort_order=order
        )
        version = CriterionVersion.objects.create(
            criterion=criterion, version=1, created_by=actor, **data
        )
        criterion.current_version = version
        criterion.save(update_fields=["current_version", "updated_at"])
        publish(
            events.CriterionChanged(
                actor_id=_pk(actor), target_id=str(criterion.public_id), action="created", version=1
            )
        )
    return criterion


def update_criterion(*, actor, criterion: RatingCriterion, **changes) -> RatingCriterion:
    """Wording/scale changes create a new immutable version (BR-07). ``category`` and
    ``is_active`` change in place."""
    if criterion.is_archived:
        raise BusinessRuleViolation("Archived criteria cannot be changed.")
    allowed = set(VERSION_FIELDS) | {"category_id", "is_active"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValidationError(
            fields={f: ["This field cannot be changed."] for f in sorted(unknown)}
        )

    current = criterion.current_version
    with transaction.atomic():
        diff: list[tuple[str, object, object]] = []
        version_changes = {f: changes[f] for f in VERSION_FIELDS if f in changes}
        new_version_number = None
        if version_changes:
            merged = {f: getattr(current, f) for f in VERSION_FIELDS} | version_changes
            data = _clean_version_data(merged)
            changed = [f for f in VERSION_FIELDS if data[f] != getattr(current, f)]
            if changed:
                new_version_number = current.version + 1
                new = CriterionVersion.objects.create(
                    criterion=criterion, version=new_version_number, created_by=actor, **data
                )
                diff += [(f, str(getattr(current, f)), str(data[f])) for f in changed]
                criterion.current_version = new
        if "category_id" in changes and changes["category_id"] != criterion.category_id:
            diff.append(("category_id", criterion.category_id, changes["category_id"]))
            criterion.category = _category(changes["category_id"])
        if "is_active" in changes and bool(changes["is_active"]) != criterion.is_active:
            diff.append(("is_active", criterion.is_active, bool(changes["is_active"])))
            criterion.is_active = bool(changes["is_active"])
        if diff:
            criterion.save()
            publish(
                events.CriterionChanged(
                    actor_id=_pk(actor),
                    target_id=str(criterion.public_id),
                    action="updated",
                    version=new_version_number,
                    changes=tuple(diff),
                )
            )
    return criterion


def reorder_criteria(*, actor, ordered_public_ids: Sequence[str]) -> None:
    criteria = {str(c.public_id): c for c in RatingCriterion.objects.filter(is_archived=False)}
    if sorted(map(str, ordered_public_ids)) != sorted(criteria):
        raise ValidationError(fields={"order": ["List every non-archived criterion exactly once."]})
    with transaction.atomic():
        for position, public_id in enumerate(ordered_public_ids, start=1):
            criterion = criteria[str(public_id)]
            if criterion.sort_order != position:
                criterion.sort_order = position
                criterion.save(update_fields=["sort_order", "updated_at"])
        publish(events.CriterionChanged(actor_id=_pk(actor), action="reordered"))


def archive_criterion(*, actor, criterion: RatingCriterion) -> RatingCriterion:
    """Hide from new forms; history keeps its versions (BR-07)."""
    if criterion.is_archived:
        return criterion
    criterion.is_archived, criterion.is_active = True, False
    criterion.save(update_fields=["is_archived", "is_active", "updated_at"])
    publish(
        events.CriterionChanged(
            actor_id=_pk(actor), target_id=str(criterion.public_id), action="archived"
        )
    )
    return criterion


# ---------------------------------------------------------------------------
# Form versions (CFG-04, CFG-06, BR-18)
# ---------------------------------------------------------------------------
FORM_FIELDS = (
    "title",
    "comment_required",
    "suggestion_required",
    "comment_max_length",
    "suggestion_max_length",
)


def _clean_form_fields(data: dict) -> dict:
    errors: dict[str, list[str]] = {}
    if "title" in data:
        data["title"] = str(data["title"]).strip()
        if not data["title"]:
            errors["title"] = ["Enter a title."]
    for field in ("comment_max_length", "suggestion_max_length"):
        if field in data and not (1 <= int(data[field]) <= TEXT_LIMIT_MAX):
            errors[field] = [f"Choose a limit between 1 and {TEXT_LIMIT_MAX}."]
    if errors:
        raise ValidationError(fields=errors)
    return data


def _criteria_in_order(criterion_ids: Sequence[str]) -> list[RatingCriterion]:
    if not criterion_ids:
        raise ValidationError(fields={"criteria": ["Choose at least one criterion."]})
    if len(set(map(str, criterion_ids))) != len(criterion_ids):
        raise ValidationError(fields={"criteria": ["Each criterion can be used once."]})
    found = {
        str(c.public_id): c
        for c in RatingCriterion.objects.filter(public_id__in=list(criterion_ids)).select_related(
            "current_version"
        )
    }
    errors = []
    for public_id in criterion_ids:
        criterion = found.get(str(public_id))
        if criterion is None or criterion.is_archived or not criterion.is_active:
            errors.append(f"{public_id} is not an active criterion.")
    if errors:
        raise ValidationError(fields={"criteria": errors})
    return [found[str(pid)] for pid in criterion_ids]


def _set_items(form: FormVersion, criteria: list[RatingCriterion]) -> None:
    if FormVersion.objects.filter(pk=form.pk, status=FormStatus.PUBLISHED).exists():
        raise BusinessRuleViolation("Published forms cannot be changed (BR-18).")
    form.items.all().delete()
    FormVersionItem.objects.bulk_create(
        FormVersionItem(form_version=form, criterion_version=c.current_version, order=i)
        for i, c in enumerate(criteria, start=1)
    )


def create_form_version(*, actor, criteria: Sequence[str], **fields) -> FormVersion:
    unknown = set(fields) - set(FORM_FIELDS)
    if unknown:
        raise ValidationError(fields={f: ["Unknown field."] for f in sorted(unknown)})
    fields = _clean_form_fields({"title": fields.pop("title", ""), **fields})
    ordered = _criteria_in_order(criteria)
    with transaction.atomic():
        number = (FormVersion.objects.select_for_update().aggregate(m=Max("version"))["m"] or 0) + 1
        form = FormVersion.objects.create(version=number, created_by=actor, **fields)
        _set_items(form, ordered)
        publish(
            events.FormChanged(actor_id=_pk(actor), target_id=str(form.public_id), action="created")
        )
    return form


def update_form_version(
    *, actor, form: FormVersion, criteria: Sequence[str] | None = None, **fields
) -> FormVersion:
    if form.status != FormStatus.DRAFT:
        raise BusinessRuleViolation("Published forms cannot be changed. Create a new version.")
    unknown = set(fields) - set(FORM_FIELDS)
    if unknown:
        raise ValidationError(fields={f: ["Unknown field."] for f in sorted(unknown)})
    fields = _clean_form_fields(fields)
    with transaction.atomic():
        diff = tuple(
            (f, getattr(form, f), v) for f, v in sorted(fields.items()) if getattr(form, f) != v
        )
        for field, _old, new in diff:
            setattr(form, field, new)
        if diff:
            form.save()
        if criteria is not None:
            _set_items(form, _criteria_in_order(criteria))
        if diff or criteria is not None:
            publish(
                events.FormChanged(
                    actor_id=_pk(actor),
                    target_id=str(form.public_id),
                    action="updated",
                    changes=diff,
                )
            )
    return form


def publish_form_version(*, actor, form: FormVersion) -> FormVersion:
    """Freeze the form. Items are re-pointed to each criterion's *current* version first, so
    a draft never publishes stale wording."""
    if form.status != FormStatus.DRAFT:
        raise BusinessRuleViolation("This form is already published.")
    with transaction.atomic():
        items = list(form.items.select_related("criterion_version__criterion__current_version"))
        if not items:
            raise ValidationError(fields={"criteria": ["Choose at least one criterion."]})
        criteria = [item.criterion_version.criterion for item in items]
        _criteria_in_order([str(c.public_id) for c in criteria])  # still all active
        _set_items(form, criteria)
        form.status = FormStatus.PUBLISHED
        form.published_at = timezone.now()
        FormVersion.objects.filter(pk=form.pk).update(
            status=form.status, published_at=form.published_at, updated_at=timezone.now()
        )
        version_ids = tuple(form.items.values_list("criterion_version_id", flat=True))
        publish(
            events.FormPublished(
                actor_id=_pk(actor),
                target_id=str(form.public_id),
                version=form.version,
                criterion_version_ids=version_ids,
            )
        )
    return form


# ---------------------------------------------------------------------------
# Cycles (EVAL-06, CFG-05, BR-13)
# ---------------------------------------------------------------------------
CYCLE_FIELDS = {
    "name",
    "description",
    "starts_at",
    "ends_at",
    "edit_deadline",
    "form_version_id",
    "allow_resubmission",
    "evaluation_scope",
    "feedback_visibility",
}
EDITABLE_WHEN = {
    CycleStatus.DRAFT: CYCLE_FIELDS,
    CycleStatus.OPEN: {"name", "description", "ends_at", "edit_deadline"},
    CycleStatus.CLOSED: {"name", "description"},
    CycleStatus.ARCHIVED: {"name", "description"},
}


def _validate_cycle(values: dict) -> None:
    errors: dict[str, list[str]] = {}
    if not str(values.get("name", "")).strip():
        errors["name"] = ["Enter a name."]
    starts, ends, edit = values["starts_at"], values["ends_at"], values["edit_deadline"]
    if ends <= starts:
        errors["ends_at"] = ["The end must be after the start."]
    if edit < starts:
        errors["edit_deadline"] = ["The edit deadline cannot be before the start."]
    if values["evaluation_scope"] not in EvaluationScope.values:
        errors["evaluation_scope"] = ["Choose a valid scope."]
    if values["feedback_visibility"] not in FeedbackVisibility.values:
        errors["feedback_visibility"] = ["Choose a valid visibility."]
    form_id = values.get("form_version_id")
    if (
        form_id is not None
        and not FormVersion.objects.filter(pk=form_id, status=FormStatus.PUBLISHED).exists()
    ):
        errors["form_version"] = ["Choose a published form version."]
    if errors:
        raise ValidationError(fields=errors)


def create_cycle(
    *,
    actor,
    name: str,
    starts_at: datetime,
    ends_at: datetime,
    edit_deadline: datetime | None = None,
    description: str = "",
    form_version_id: int | None = None,
    allow_resubmission: bool = False,
    evaluation_scope: str = EvaluationScope.ALL,
    feedback_visibility: str = FeedbackVisibility.IMMEDIATE,
) -> EvaluationCycle:
    values = {
        "name": name.strip(),
        "description": description.strip(),
        "starts_at": starts_at,
        "ends_at": ends_at,
        "edit_deadline": edit_deadline or ends_at,
        "form_version_id": form_version_id,
        "allow_resubmission": allow_resubmission,
        "evaluation_scope": evaluation_scope,
        "feedback_visibility": feedback_visibility,
    }
    _validate_cycle(values)
    cycle = EvaluationCycle.objects.create(created_by=actor, **values)
    publish(
        events.CycleChanged(actor_id=_pk(actor), target_id=str(cycle.public_id), action="created")
    )
    return cycle


def update_cycle(*, actor, cycle: EvaluationCycle, **changes) -> EvaluationCycle:
    unknown = set(changes) - CYCLE_FIELDS
    if unknown:
        raise ValidationError(fields={f: ["Unknown field."] for f in sorted(unknown)})
    locked = set(changes) - EDITABLE_WHEN[CycleStatus(cycle.status)]
    if locked:
        raise BusinessRuleViolation(
            f"These settings can't change while the cycle is {cycle.status.lower()}: "
            + ", ".join(sorted(locked))
        )
    values = {f: getattr(cycle, f) for f in CYCLE_FIELDS} | changes
    _validate_cycle(values)
    diff = tuple(
        (f, str(getattr(cycle, f)), str(v))
        for f, v in sorted(changes.items())
        if getattr(cycle, f) != v
    )
    if diff:
        for field in changes:
            setattr(cycle, field, values[field])
        cycle.save()
        publish(
            events.CycleChanged(
                actor_id=_pk(actor), target_id=str(cycle.public_id), action="updated", changes=diff
            )
        )
    return cycle


def open_cycle(*, actor, cycle: EvaluationCycle) -> EvaluationCycle:
    """DRAFT → OPEN. Needs a published form; only one cycle may be open at a time."""
    if cycle.status != CycleStatus.DRAFT:
        raise BusinessRuleViolation("Only draft cycles can be opened.")
    if cycle.form_version_id is None:
        raise BusinessRuleViolation("Choose a published form version before opening the cycle.")
    if cycle.ends_at <= timezone.now():
        raise BusinessRuleViolation("This cycle has already ended. Change its dates first.")
    if EvaluationCycle.objects.filter(status=CycleStatus.OPEN).exclude(pk=cycle.pk).exists():
        raise BusinessRuleViolation("Another cycle is already open. Close it first.")
    try:
        with transaction.atomic():
            updated = EvaluationCycle.objects.filter(pk=cycle.pk, status=CycleStatus.DRAFT).update(
                status=CycleStatus.OPEN,
                is_current=True,
                opened_at=timezone.now(),
                updated_at=timezone.now(),
            )
            if not updated:
                raise BusinessRuleViolation("Only draft cycles can be opened.")
            publish(
                events.CycleOpened(
                    actor_id=_pk(actor),
                    target_id=str(cycle.public_id),
                    cycle_id=cycle.pk,
                    cycle_name=cycle.name,
                    feedback_visibility=cycle.feedback_visibility,
                )
            )
    except IntegrityError as exc:  # is_current unique: someone opened another cycle meanwhile
        raise BusinessRuleViolation("Another cycle is already open. Close it first.") from exc
    cycle.refresh_from_db()
    return cycle


def close_cycle(*, actor, cycle: EvaluationCycle) -> EvaluationCycle:
    if cycle.status != CycleStatus.OPEN:
        raise BusinessRuleViolation("Only open cycles can be closed.")
    with transaction.atomic():
        EvaluationCycle.objects.filter(pk=cycle.pk).update(
            status=CycleStatus.CLOSED,
            is_current=None,
            closed_at=timezone.now(),
            updated_at=timezone.now(),
        )
        publish(
            events.CycleClosed(
                actor_id=_pk(actor),
                target_id=str(cycle.public_id),
                cycle_id=cycle.pk,
                cycle_name=cycle.name,
                feedback_visibility=cycle.feedback_visibility,
            )
        )
    cycle.refresh_from_db()
    return cycle


def close_expired_cycles(*, now=None) -> list[EvaluationCycle]:
    """Close every OPEN cycle whose ``ends_at`` has passed (run by the worker / cron).
    Submissions already stop at ``ends_at`` (rules.py); closing also releases AFTER_CLOSE
    feedback and sends the "period closed" notifications. Actor: the system (None)."""
    now = now or timezone.now()
    closed = []
    for cycle in EvaluationCycle.objects.filter(status=CycleStatus.OPEN, ends_at__lte=now):
        try:
            closed.append(close_cycle(actor=None, cycle=cycle))
        except BusinessRuleViolation:
            continue  # closed meanwhile by an admin
    return closed


def archive_cycle(*, actor, cycle: EvaluationCycle) -> EvaluationCycle:
    if cycle.status != CycleStatus.CLOSED:
        raise BusinessRuleViolation("Only closed cycles can be archived.")
    cycle.status = CycleStatus.ARCHIVED
    cycle.save(update_fields=["status", "updated_at"])
    publish(
        events.CycleChanged(actor_id=_pk(actor), target_id=str(cycle.public_id), action="archived")
    )
    return cycle


# ---------------------------------------------------------------------------
# Data retention (SET-03, step 6.4)
# ---------------------------------------------------------------------------
def apply_retention(*, actor=None, now=None) -> dict[str, int]:
    """SET-03: purge evaluations, revisions, and audit logs older than the configured windows.

    - ``retention_evaluations_days = None`` keeps evaluations forever.
    - Evaluations inside an OPEN cycle are never purged, even if ``submitted_at`` is older
      than the window.
    - ``retention_revisions_days = None`` keeps historical revisions (revision > 1) forever.
    - ``retention_audit_days = None`` keeps audit logs forever.
    """
    moment = now or timezone.now()
    cfg = get_settings()
    purged_evaluations = 0
    purged_revisions = 0

    with transaction.atomic():
        if cfg.retention_evaluations_days is not None and cfg.retention_evaluations_days > 0:
            cutoff = moment - timedelta(days=int(cfg.retention_evaluations_days))
            expired_ids = list(
                Evaluation.objects.filter(
                    submitted_at__lt=cutoff,
                    cycle__status__in=[CycleStatus.CLOSED, CycleStatus.ARCHIVED],
                ).values_list("id", flat=True)
            )
            if expired_ids:
                models.QuerySet.delete(
                    EvaluationRating.objects.filter(evaluation_id__in=expired_ids)
                )
                models.QuerySet.delete(
                    EvaluationComment.objects.filter(evaluation_id__in=expired_ids)
                )
                models.QuerySet.delete(
                    EvaluationRevision.objects.filter(evaluation_id__in=expired_ids)
                )
                models.QuerySet.delete(
                    ModerationAction.objects.filter(evaluation_id__in=expired_ids)
                )
                purged_evaluations, _ = models.QuerySet.delete(
                    Evaluation.objects.filter(id__in=expired_ids)
                )

        if cfg.retention_revisions_days is not None and cfg.retention_revisions_days > 0:
            rev_cutoff = moment - timedelta(days=int(cfg.retention_revisions_days))
            purged_revisions, _ = models.QuerySet.delete(
                EvaluationRevision.objects.filter(created_at__lt=rev_cutoff)
            )

        purged_audit_logs = audit_services.purge_expired_logs(
            retention_days=cfg.retention_audit_days, now=moment
        )

        if purged_evaluations or purged_revisions or purged_audit_logs or actor is not None:
            audit_services.record(
                event_type="system.retention.applied",
                actor=actor,
                target_type="system.SystemSettings",
                target_id=1,
                metadata={
                    "retention_evaluations_days": cfg.retention_evaluations_days,
                    "retention_revisions_days": cfg.retention_revisions_days,
                    "retention_audit_days": cfg.retention_audit_days,
                    "purged_evaluations": purged_evaluations,
                    "purged_revisions": purged_revisions,
                    "purged_audit_logs": purged_audit_logs,
                },
            )

    return {
        "purged_evaluations": purged_evaluations,
        "purged_revisions": purged_revisions,
        "purged_audit_logs": purged_audit_logs,
    }


