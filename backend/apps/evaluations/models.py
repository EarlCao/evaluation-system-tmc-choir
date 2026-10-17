"""Evaluation configuration models (step 2.2). Submissions and revisions arrive in 2.3 / 3.1.

Versioning rules (Data Model, BR-07, BR-18, CFG-06):
- A ``RatingCriterion`` is a stable identity; its wording and scale live in immutable
  ``CriterionVersion`` rows. Editing creates a new version.
- A ``FormVersion`` freezes specific criterion versions when it is published.
- A cycle uses one published form; historical evaluations keep their versions.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.core.models import AppendOnlyModel, PublicIdModel, TimeStampedModel

from .constants import (
    CRITERION_DESCRIPTION_MAX,
    CRITERION_NAME_MAX,
    DEFAULT_TEXT_LIMIT,
    CycleStatus,
    EvaluationScope,
    FeedbackVisibility,
    FormStatus,
    ScaleType,
)


class CriterionCategory(TimeStampedModel):
    name = models.CharField(max_length=60, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "criterion categories"

    def __str__(self) -> str:
        return self.name


class RatingCriterion(PublicIdModel, TimeStampedModel):
    key = models.SlugField(max_length=60, unique=True)
    category = models.ForeignKey(
        CriterionCategory, null=True, blank=True, on_delete=models.PROTECT, related_name="criteria"
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    current_version = models.ForeignKey(
        "CriterionVersion", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name_plural = "rating criteria"

    def __str__(self) -> str:
        return self.key


class CriterionVersion(AppendOnlyModel):
    """Immutable wording + scale of a criterion. Never edited; editing creates a new row."""

    criterion = models.ForeignKey(
        RatingCriterion, on_delete=models.PROTECT, related_name="versions"
    )
    version = models.PositiveIntegerField()
    name = models.CharField(max_length=CRITERION_NAME_MAX)
    description = models.CharField(max_length=CRITERION_DESCRIPTION_MAX, blank=True)
    scale_type = models.CharField(max_length=16, choices=ScaleType.choices)
    min_value = models.DecimalField(max_digits=6, decimal_places=2)
    max_value = models.DecimalField(max_digits=6, decimal_places=2)
    step = models.DecimalField(max_digits=6, decimal_places=2)
    labels = models.JSONField(default=dict, blank=True)
    is_required = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["criterion_id", "version"]
        constraints = [
            models.UniqueConstraint(
                fields=["criterion", "version"], name="criterion_version_unique"
            ),
            models.CheckConstraint(
                condition=Q(max_value__gt=F("min_value")), name="criterion_version_range"
            ),
            models.CheckConstraint(condition=Q(step__gt=0), name="criterion_version_step"),
        ]

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"


class FormVersion(PublicIdModel, TimeStampedModel):
    """A set of criterion versions plus comment rules. Frozen once PUBLISHED."""

    version = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=120)
    status = models.CharField(
        max_length=16, choices=FormStatus.choices, default=FormStatus.DRAFT, db_index=True
    )
    comment_required = models.BooleanField(default=False)
    suggestion_required = models.BooleanField(default=False)
    comment_max_length = models.PositiveIntegerField(default=DEFAULT_TEXT_LIMIT)
    suggestion_max_length = models.PositiveIntegerField(default=DEFAULT_TEXT_LIMIT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["-version"]

    def __str__(self) -> str:
        return f"{self.title} (v{self.version})"

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk, status=FormStatus.PUBLISHED).exists():
            raise ValidationError("A published form version cannot be changed (BR-18).")
        super().save(*args, **kwargs)


class FormVersionItem(models.Model):
    form_version = models.ForeignKey(FormVersion, on_delete=models.PROTECT, related_name="items")
    criterion_version = models.ForeignKey(
        CriterionVersion, on_delete=models.PROTECT, related_name="form_items"
    )
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["form_version_id", "order"]
        constraints = [
            models.UniqueConstraint(
                fields=["form_version", "criterion_version"], name="form_item_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.form_version_id}#{self.order}"


class EvaluationCycle(PublicIdModel, TimeStampedModel):
    """An evaluation period (EVAL-06, CFG-05)."""

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=2000)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    edit_deadline = models.DateTimeField(
        help_text="Authors may edit until this moment (defaults to the end of the cycle)."
    )
    status = models.CharField(
        max_length=16, choices=CycleStatus.choices, default=CycleStatus.DRAFT, db_index=True
    )
    # True while OPEN, NULL otherwise. The unique index guarantees at most one open cycle
    # at the database level (MySQL has no partial unique indexes).
    is_current = models.BooleanField(null=True, blank=True, unique=True, editable=False)
    form_version = models.ForeignKey(
        FormVersion, null=True, blank=True, on_delete=models.PROTECT, related_name="cycles"
    )
    allow_resubmission = models.BooleanField(default=False)
    evaluation_scope = models.CharField(
        max_length=16, choices=EvaluationScope.choices, default=EvaluationScope.ALL
    )
    feedback_visibility = models.CharField(
        max_length=16, choices=FeedbackVisibility.choices, default=FeedbackVisibility.IMMEDIATE
    )
    opened_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["-starts_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")), name="cycle_ends_after_start"
            ),
            models.CheckConstraint(
                condition=Q(edit_deadline__gte=F("starts_at")), name="cycle_edit_after_start"
            ),
        ]

    def __str__(self) -> str:
        return self.name
