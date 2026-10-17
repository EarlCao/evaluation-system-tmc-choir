"""Public read API of the evaluations module (configuration part, step 2.2)."""

from uuid import UUID

from django.db.models import Prefetch, QuerySet

from apps.core.exceptions import NotFound

from .constants import CycleStatus, FormStatus
from .models import (
    CriterionCategory,
    CriterionVersion,
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
