"""Member-facing serializers. These are the **author's** views: they may show the recipient
(the author chose them) but never another evaluator. Recipient-facing feedback lives in
``apps.feedback`` (Privacy Model)."""

from rest_framework import serializers

from apps.members.api.serializers import VoiceSectionSerializer

from .. import rules
from ..constants import CommentKind
from ..models import (
    CriterionVersion,
    Evaluation,
    EvaluationCycle,
    EvaluationRevision,
    FormVersionItem,
)

_decimal = {"max_digits": 6, "decimal_places": 2, "coerce_to_string": False}


class CycleSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationCycle
        fields = [
            "public_id",
            "name",
            "description",
            "status",
            "starts_at",
            "ends_at",
            "edit_deadline",
            "evaluation_scope",
            "allow_resubmission",
        ]


class CurrentCycleSerializer(serializers.Serializer):
    cycle = CycleSummarySerializer(allow_null=True)


class FormCriterionSerializer(serializers.ModelSerializer):
    criterion_version = serializers.IntegerField(source="criterion_version.id")
    name = serializers.CharField(source="criterion_version.name")
    description = serializers.CharField(source="criterion_version.description")
    category = serializers.CharField(
        source="criterion_version.criterion.category.name", default=None, allow_null=True
    )
    scale_type = serializers.CharField(source="criterion_version.scale_type")
    min_value = serializers.DecimalField(source="criterion_version.min_value", **_decimal)
    max_value = serializers.DecimalField(source="criterion_version.max_value", **_decimal)
    step = serializers.DecimalField(source="criterion_version.step", **_decimal)
    labels = serializers.DictField(source="criterion_version.labels", child=serializers.CharField())
    is_required = serializers.BooleanField(source="criterion_version.is_required")

    class Meta:
        model = FormVersionItem
        fields = [
            "order",
            "criterion_version",
            "name",
            "description",
            "category",
            "scale_type",
            "min_value",
            "max_value",
            "step",
            "labels",
            "is_required",
        ]


class CycleFormSerializer(serializers.Serializer):
    """Everything the evaluate page needs to render the form (EVAL-01, EVAL-03..05)."""

    cycle = CycleSummarySerializer(source="*")
    comment_required = serializers.BooleanField(source="form_version.comment_required")
    suggestion_required = serializers.BooleanField(source="form_version.suggestion_required")
    comment_max_length = serializers.IntegerField(source="form_version.comment_max_length")
    suggestion_max_length = serializers.IntegerField(source="form_version.suggestion_max_length")
    criteria = FormCriterionSerializer(source="form_version.items", many=True)


class EligibilitySerializer(serializers.Serializer):
    can_evaluate = serializers.BooleanField()
    reason = serializers.CharField(allow_null=True)
    message = serializers.CharField(allow_null=True)
    existing_evaluation = serializers.SerializerMethodField()

    def get_existing_evaluation(self, obj: rules.Eligibility) -> str | None:
        return str(obj.existing.public_id) if obj.existing else None


class RatingInputSerializer(serializers.Serializer):
    criterion_version = serializers.IntegerField(min_value=1)
    value = serializers.DecimalField(allow_null=True, required=False, **_decimal)


class SubmitEvaluationSerializer(serializers.Serializer):
    recipient = serializers.UUIDField()
    ratings = RatingInputSerializer(many=True, allow_empty=True)
    comment = serializers.CharField(
        allow_blank=True, required=False, default="", trim_whitespace=False
    )
    suggestion = serializers.CharField(
        allow_blank=True, required=False, default="", trim_whitespace=False
    )


class RecipientSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    display_name = serializers.CharField()
    voice_section = VoiceSectionSerializer(source="member_profile.voice_section", allow_null=True)


class CriterionInfoSerializer(serializers.ModelSerializer):
    min_value = serializers.DecimalField(**_decimal)
    max_value = serializers.DecimalField(**_decimal)
    step = serializers.DecimalField(**_decimal)

    class Meta:
        model = CriterionVersion
        fields = ["id", "name", "scale_type", "min_value", "max_value", "step", "labels"]


class MyRatingSerializer(serializers.Serializer):
    criterion_version = CriterionInfoSerializer()
    value = serializers.DecimalField(allow_null=True, **_decimal)
    label = serializers.CharField()


class MyEvaluationSerializer(serializers.ModelSerializer):
    """MINE-01: one evaluation as its author sees it."""

    cycle = CycleSummarySerializer()
    recipient = RecipientSerializer()
    ratings = MyRatingSerializer(many=True)
    comment = serializers.SerializerMethodField()
    suggestion = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            "public_id",
            "cycle",
            "recipient",
            "submitted_at",
            "last_edited_at",
            "is_edited",
            "current_revision_number",
            "ratings",
            "comment",
            "suggestion",
            "can_edit",
        ]

    @staticmethod
    def _text(obj: Evaluation, kind: str) -> str:
        return next((c.body for c in obj.comments.all() if c.kind == kind), "")

    def get_comment(self, obj: Evaluation) -> str:
        return self._text(obj, CommentKind.COMMENT)

    def get_suggestion(self, obj: Evaluation) -> str:
        return self._text(obj, CommentKind.SUGGESTION)

    def get_can_edit(self, obj: Evaluation) -> bool:
        return rules.can_edit(obj)


class EditEvaluationSerializer(serializers.Serializer):
    ratings = RatingInputSerializer(many=True, allow_empty=True)
    comment = serializers.CharField(
        allow_blank=True, required=False, default="", trim_whitespace=False
    )
    suggestion = serializers.CharField(
        allow_blank=True, required=False, default="", trim_whitespace=False
    )
    change_summary = serializers.CharField(
        allow_blank=True, required=False, default="", max_length=200
    )


class MyRevisionSerializer(serializers.ModelSerializer):
    """MINE-04: original/edited content and time, for the author only. The editor is always
    the author here, so no identity field is sent (privacy sweep, step 3.4); the Super Admin's
    revision view includes the editor (step 4.4)."""

    class Meta:
        model = EvaluationRevision
        fields = ["revision_number", "created_at", "change_summary", "snapshot"]
