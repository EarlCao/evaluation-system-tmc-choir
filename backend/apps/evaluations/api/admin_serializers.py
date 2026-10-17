"""Super Admin serializers for evaluation configuration (explicit fields only)."""

from rest_framework import serializers

from ..constants import (
    CRITERION_DESCRIPTION_MAX,
    CRITERION_NAME_MAX,
    LABEL_MAX,
    TEXT_LIMIT_MAX,
    EvaluationScope,
    FeedbackVisibility,
    ScaleType,
)
from ..models import (
    CriterionCategory,
    CriterionVersion,
    EvaluationCycle,
    FormVersion,
    FormVersionItem,
    RatingCriterion,
)


def _decimal(**kwargs):
    return serializers.DecimalField(
        max_digits=6, decimal_places=2, coerce_to_string=False, **kwargs
    )


# Categories ------------------------------------------------------------------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CriterionCategory
        fields = ["id", "name", "sort_order", "is_archived"]


class CategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)


class CategoryUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, required=False)
    sort_order = serializers.IntegerField(min_value=0, required=False)
    is_archived = serializers.BooleanField(required=False)


# Criteria --------------------------------------------------------------------
class CriterionVersionSerializer(serializers.ModelSerializer):
    min_value = _decimal()
    max_value = _decimal()
    step = _decimal()

    class Meta:
        model = CriterionVersion
        fields = [
            "id",
            "version",
            "name",
            "description",
            "scale_type",
            "min_value",
            "max_value",
            "step",
            "labels",
            "is_required",
            "created_at",
        ]


class CriterionSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    current_version = CriterionVersionSerializer(read_only=True)

    class Meta:
        model = RatingCriterion
        fields = [
            "public_id",
            "key",
            "category",
            "sort_order",
            "is_active",
            "is_archived",
            "current_version",
            "created_at",
        ]


class _VersionFields(serializers.Serializer):
    name = serializers.CharField(max_length=CRITERION_NAME_MAX)
    description = serializers.CharField(
        max_length=CRITERION_DESCRIPTION_MAX, allow_blank=True, required=False, default=""
    )
    scale_type = serializers.ChoiceField(choices=ScaleType.choices)
    min_value = _decimal()
    max_value = _decimal()
    step = _decimal()
    labels = serializers.DictField(
        child=serializers.CharField(max_length=LABEL_MAX), required=False, default=dict
    )
    is_required = serializers.BooleanField(required=False, default=True)


class CriterionCreateSerializer(_VersionFields):
    key = serializers.SlugField(max_length=60, required=False, allow_blank=True, default="")
    category = serializers.IntegerField(required=False, allow_null=True, default=None)


class CriterionUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=CRITERION_NAME_MAX, required=False)
    description = serializers.CharField(
        max_length=CRITERION_DESCRIPTION_MAX, allow_blank=True, required=False
    )
    scale_type = serializers.ChoiceField(choices=ScaleType.choices, required=False)
    min_value = _decimal(required=False)
    max_value = _decimal(required=False)
    step = _decimal(required=False)
    labels = serializers.DictField(
        child=serializers.CharField(max_length=LABEL_MAX), required=False
    )
    is_required = serializers.BooleanField(required=False)
    category = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)


class ReorderSerializer(serializers.Serializer):
    order = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


# Form versions -----------------------------------------------------------------
class FormItemSerializer(serializers.ModelSerializer):
    criterion_public_id = serializers.UUIDField(
        source="criterion_version.criterion.public_id", read_only=True
    )
    criterion_version = CriterionVersionSerializer(read_only=True)

    class Meta:
        model = FormVersionItem
        fields = ["order", "criterion_public_id", "criterion_version"]


class FormVersionSerializer(serializers.ModelSerializer):
    items = FormItemSerializer(many=True, read_only=True)

    class Meta:
        model = FormVersion
        fields = [
            "public_id",
            "version",
            "title",
            "status",
            "comment_required",
            "suggestion_required",
            "comment_max_length",
            "suggestion_max_length",
            "published_at",
            "created_at",
            "items",
        ]


class FormWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    criteria = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    comment_required = serializers.BooleanField(required=False, default=False)
    suggestion_required = serializers.BooleanField(required=False, default=False)
    comment_max_length = serializers.IntegerField(
        min_value=1, max_value=TEXT_LIMIT_MAX, required=False
    )
    suggestion_max_length = serializers.IntegerField(
        min_value=1, max_value=TEXT_LIMIT_MAX, required=False
    )


class FormUpdateSerializer(FormWriteSerializer):
    title = serializers.CharField(max_length=120, required=False)
    criteria = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, required=False
    )
    comment_required = serializers.BooleanField(required=False)
    suggestion_required = serializers.BooleanField(required=False)


# Cycles ----------------------------------------------------------------------
class FormSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = FormVersion
        fields = ["public_id", "version", "title"]


class CycleSerializer(serializers.ModelSerializer):
    form_version = FormSummarySerializer(read_only=True)

    class Meta:
        model = EvaluationCycle
        fields = [
            "public_id",
            "name",
            "description",
            "starts_at",
            "ends_at",
            "edit_deadline",
            "status",
            "form_version",
            "allow_resubmission",
            "evaluation_scope",
            "feedback_visibility",
            "opened_at",
            "closed_at",
            "created_at",
        ]


class CycleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(
        max_length=2000, allow_blank=True, required=False, default=""
    )
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    edit_deadline = serializers.DateTimeField(required=False, allow_null=True, default=None)
    form_version = serializers.UUIDField(required=False, allow_null=True, default=None)
    allow_resubmission = serializers.BooleanField(required=False, default=False)
    evaluation_scope = serializers.ChoiceField(
        choices=EvaluationScope.choices, required=False, default=EvaluationScope.ALL
    )
    feedback_visibility = serializers.ChoiceField(
        choices=FeedbackVisibility.choices, required=False, default=FeedbackVisibility.IMMEDIATE
    )


class CycleUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    starts_at = serializers.DateTimeField(required=False)
    ends_at = serializers.DateTimeField(required=False)
    edit_deadline = serializers.DateTimeField(required=False)
    form_version = serializers.UUIDField(required=False, allow_null=True)
    allow_resubmission = serializers.BooleanField(required=False)
    evaluation_scope = serializers.ChoiceField(choices=EvaluationScope.choices, required=False)
    feedback_visibility = serializers.ChoiceField(
        choices=FeedbackVisibility.choices, required=False
    )
