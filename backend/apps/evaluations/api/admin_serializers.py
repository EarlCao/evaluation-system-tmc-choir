"""Super Admin serializers for evaluation configuration (explicit fields only)."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..constants import (
    COMMENT_PROMPT_LABEL_MAX,
    CRITERION_DESCRIPTION_MAX,
    CRITERION_NAME_MAX,
    LABEL_MAX,
    TEXT_LIMIT_MAX,
    CommentKind,
    EvaluationScope,
    FeedbackVisibility,
    ModerationStatus,
    ModerationTarget,
    ScaleType,
)
from ..constants import ModerationAction as ModerationActionKind
from ..models import (
    CommentPrompt,
    CriterionCategory,
    CriterionVersion,
    Evaluation,
    EvaluationCycle,
    EvaluationRevision,
    FormVersion,
    FormVersionItem,
    ModerationAction,
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
    is_archived = serializers.BooleanField(required=False)


class ReorderSerializer(serializers.Serializer):
    order = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


# Comment prompts ---------------------------------------------------------------
class CommentPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommentPrompt
        fields = [
            "public_id",
            "key",
            "label",
            "is_required",
            "sort_order",
            "is_active",
            "is_archived",
            "created_at",
        ]


class CommentPromptCreateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=COMMENT_PROMPT_LABEL_MAX)
    key = serializers.SlugField(max_length=60, required=False, allow_blank=True, default="")
    is_required = serializers.BooleanField(required=False, default=False)


class CommentPromptUpdateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=COMMENT_PROMPT_LABEL_MAX, required=False)
    is_required = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
    is_archived = serializers.BooleanField(required=False)


# Form versions -----------------------------------------------------------------
class FormCommentPromptSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    label = serializers.CharField(max_length=COMMENT_PROMPT_LABEL_MAX)
    is_required = serializers.BooleanField(required=False, default=False)


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
    comment_prompts = FormCommentPromptSerializer(
        source="effective_comment_prompts", many=True, read_only=True
    )

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
            "comment_prompts",
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
    comment_prompts = serializers.ListField(
        child=FormCommentPromptSerializer(), required=False
    )


class FormUpdateSerializer(FormWriteSerializer):
    title = serializers.CharField(max_length=120, required=False)
    criteria = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, required=False
    )
    comment_required = serializers.BooleanField(required=False)
    suggestion_required = serializers.BooleanField(required=False)
    comment_prompts = serializers.ListField(
        child=FormCommentPromptSerializer(), required=False
    )


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


# Evaluations browser & moderation (ADM-02/03/05) ------------------------------------------
class PersonSerializer(serializers.Serializer):
    """An evaluator or recipient as the Super Admin sees them."""

    public_id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    display_name = serializers.CharField()
    voice_section = serializers.CharField(
        source="member_profile.voice_section.name", allow_null=True, default=None
    )


class AdminCycleRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationCycle
        fields = ["public_id", "name", "status"]


class AdminRatingSerializer(serializers.Serializer):
    criterion_public_id = serializers.UUIDField(source="criterion_version.criterion.public_id")
    criterion_name = serializers.CharField(source="criterion_version.name")
    criterion_version = serializers.IntegerField(source="criterion_version.version")
    scale_type = serializers.CharField(source="criterion_version.scale_type")
    max_value = _decimal(source="criterion_version.max_value")
    value = _decimal(allow_null=True)
    label = serializers.CharField()


class AdminTextSerializer(serializers.Serializer):
    body = serializers.CharField()
    moderation_status = serializers.ChoiceField(choices=ModerationStatus.choices)


class AdminCommentEntrySerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    body = serializers.CharField()
    moderation_status = serializers.ChoiceField(choices=ModerationStatus.choices)


def _text(obj: Evaluation, kind: str):
    comment = next((c for c in obj.comments.all() if c.kind == kind), None)
    return AdminTextSerializer(comment).data if comment else None


class AdminEvaluationSerializer(serializers.ModelSerializer):
    """List row: identities, ratings, texts and moderation state."""

    cycle = AdminCycleRefSerializer()
    evaluator = PersonSerializer()
    recipient = PersonSerializer()
    ratings = AdminRatingSerializer(many=True)
    is_self = serializers.SerializerMethodField()
    comment = serializers.SerializerMethodField()
    suggestion = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    needs_attention = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            "public_id",
            "cycle",
            "evaluator",
            "recipient",
            "submitted_at",
            "last_edited_at",
            "is_edited",
            "current_revision_number",
            "moderation_status",
            "needs_attention",
            "is_self",
            "ratings",
            "comment",
            "suggestion",
            "comments",
        ]

    @extend_schema_field(serializers.BooleanField())
    def get_is_self(self, obj) -> bool:
        return obj.evaluator_id == obj.recipient_id

    @extend_schema_field(AdminTextSerializer(allow_null=True))
    def get_comment(self, obj):
        return _text(obj, CommentKind.COMMENT)

    @extend_schema_field(AdminTextSerializer(allow_null=True))
    def get_suggestion(self, obj):
        return _text(obj, CommentKind.SUGGESTION)

    @extend_schema_field(AdminCommentEntrySerializer(many=True))
    def get_comments(self, obj):
        prompt_labels = {
            p["key"]: p["label"] for p in obj.form_version.effective_comment_prompts
        }
        entries = []
        for c in obj.comments.all():
            key = (
                "comment"
                if c.kind == CommentKind.COMMENT
                else ("suggestion" if c.kind == CommentKind.SUGGESTION else c.kind)
            )
            label = c.label or prompt_labels.get(
                key,
                "Comments (Unsay imong ikaingon sa akoa?)"
                if key == "comment"
                else "Suggestions (Unsay imong ikasuggest sa akoa?)"
                if key == "suggestion"
                else key,
            )
            entries.append(
                {
                    "key": key,
                    "label": label,
                    "body": c.body,
                    "moderation_status": c.moderation_status,
                }
            )
        return entries

    def get_needs_attention(self, obj) -> bool:
        return obj.moderation_status == ModerationStatus.FLAGGED or bool(
            getattr(obj, "has_flagged_text", False)
        )


class ModerationActionSerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source="actor.get_full_name")

    class Meta:
        model = ModerationAction
        fields = ["target", "action", "reason", "actor", "created_at"]


class AdminEvaluationDetailSerializer(AdminEvaluationSerializer):
    moderation_history = ModerationActionSerializer(source="moderation_actions", many=True)

    class Meta(AdminEvaluationSerializer.Meta):
        fields = [*AdminEvaluationSerializer.Meta.fields, "moderation_history"]


class AdminRevisionSerializer(serializers.ModelSerializer):
    editor = PersonSerializer()

    class Meta:
        model = EvaluationRevision
        fields = ["revision_number", "created_at", "change_summary", "editor", "snapshot"]


class AdminEvaluationFilterSerializer(serializers.Serializer):
    recipient = serializers.UUIDField(required=False)
    evaluator = serializers.UUIDField(required=False)
    cycle = serializers.UUIDField(required=False)
    criterion = serializers.UUIDField(required=False)
    rating_min = _decimal(required=False)
    rating_max = _decimal(required=False)
    submitted_from = serializers.DateField(required=False)
    submitted_to = serializers.DateField(required=False)
    moderation = serializers.ChoiceField(
        choices=[*ModerationStatus.values, "attention"], required=False, default=""
    )
    edited = serializers.BooleanField(required=False, allow_null=True, default=None)
    evaluation_type = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        lo, hi = attrs.get("rating_min"), attrs.get("rating_max")
        if lo is not None and hi is not None and lo > hi:
            raise serializers.ValidationError({"rating_max": ["Must be at least the minimum."]})
        start, end = attrs.get("submitted_from"), attrs.get("submitted_to")
        if start and end and start > end:
            raise serializers.ValidationError({"submitted_to": ["Must be on or after the start."]})
        return attrs


class ModerateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ModerationActionKind.choices)
    target = serializers.ChoiceField(choices=ModerationTarget.choices)
    reason = serializers.CharField(allow_blank=True, required=False, default="", max_length=300)
