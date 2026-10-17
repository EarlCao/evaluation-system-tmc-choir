from django.contrib import admin

from .models import (
    CriterionCategory,
    CriterionVersion,
    EvaluationCycle,
    FormVersion,
    RatingCriterion,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """Emergency view only: configuration changes go through the audited API (step 4.3 UI)."""

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(CriterionCategory)
class CriterionCategoryAdmin(ReadOnlyAdmin):
    list_display = ("name", "sort_order", "is_archived")


@admin.register(RatingCriterion)
class RatingCriterionAdmin(ReadOnlyAdmin):
    list_display = ("key", "category", "sort_order", "is_active", "is_archived")


@admin.register(CriterionVersion)
class CriterionVersionAdmin(ReadOnlyAdmin):
    list_display = ("criterion", "version", "name", "scale_type", "min_value", "max_value", "step")


@admin.register(FormVersion)
class FormVersionAdmin(ReadOnlyAdmin):
    list_display = ("title", "version", "status", "published_at")


@admin.register(EvaluationCycle)
class EvaluationCycleAdmin(ReadOnlyAdmin):
    list_display = ("name", "status", "starts_at", "ends_at", "form_version")
