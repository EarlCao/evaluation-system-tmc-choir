"""Domain events of the evaluations module. Configuration events may carry ``changes``
(configuration is not personal data, ADR-014). Submission events carry IDs only."""

from dataclasses import dataclass
from typing import Any

from apps.core.events import DomainEvent

Changes = tuple[tuple[str, Any, Any], ...]


@dataclass(frozen=True, kw_only=True)
class CategoryChanged(DomainEvent):
    name = "evaluations.category.changed"
    target_type = "evaluations.CriterionCategory"
    action: str
    changes: Changes = ()


@dataclass(frozen=True, kw_only=True)
class CriterionChanged(DomainEvent):
    name = "evaluations.criterion.changed"
    target_type = "evaluations.RatingCriterion"
    action: str  # created | updated | reordered | archived
    version: int | None = None
    changes: Changes = ()


@dataclass(frozen=True, kw_only=True)
class FormChanged(DomainEvent):
    name = "evaluations.form.changed"
    target_type = "evaluations.FormVersion"
    action: str  # created | updated
    changes: Changes = ()


@dataclass(frozen=True, kw_only=True)
class FormPublished(DomainEvent):
    name = "evaluations.form.published"
    target_type = "evaluations.FormVersion"
    version: int
    criterion_version_ids: tuple[int, ...]


@dataclass(frozen=True, kw_only=True)
class CycleChanged(DomainEvent):
    name = "evaluations.cycle.changed"
    target_type = "evaluations.EvaluationCycle"
    action: str  # created | updated | archived
    changes: Changes = ()


@dataclass(frozen=True, kw_only=True)
class CycleOpened(DomainEvent):
    name = "evaluations.cycle.opened"
    target_type = "evaluations.EvaluationCycle"


@dataclass(frozen=True, kw_only=True)
class CycleClosed(DomainEvent):
    name = "evaluations.cycle.closed"
    target_type = "evaluations.EvaluationCycle"
