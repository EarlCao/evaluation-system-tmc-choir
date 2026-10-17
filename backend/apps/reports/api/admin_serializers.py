"""Super Admin report serializers (explicit fields only)."""

from rest_framework import serializers

from apps.evaluations.constants import ModerationStatus

from ..services import FILE_TYPES, REPORTS


def _decimal(**kwargs):
    return serializers.DecimalField(
        max_digits=8, decimal_places=2, coerce_to_string=False, allow_null=True, **kwargs
    )


# Filters ---------------------------------------------------------------------
class _DateRange(serializers.Serializer):
    cycle = serializers.UUIDField(required=False)
    submitted_from = serializers.DateField(required=False)
    submitted_to = serializers.DateField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("submitted_from"), attrs.get("submitted_to")
        if start and end and start > end:
            raise serializers.ValidationError({"submitted_to": ["Must be on or after the start."]})
        if "cycle" in attrs:
            attrs["cycle"] = str(attrs["cycle"])
        return attrs


class ChoirFilterSerializer(_DateRange):
    voice_section = serializers.IntegerField(required=False, min_value=1)
    criterion = serializers.UUIDField(required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "criterion" in attrs:
            attrs["criterion"] = str(attrs["criterion"])
        return attrs


class MemberFilterSerializer(_DateRange):
    pass


class ParticipationFilterSerializer(serializers.Serializer):
    cycle = serializers.UUIDField()


class EvaluationExportFilterSerializer(_DateRange):
    recipient = serializers.UUIDField(required=False)
    evaluator = serializers.UUIDField(required=False)
    criterion = serializers.UUIDField(required=False)
    rating_min = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    rating_max = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    moderation = serializers.ChoiceField(
        choices=[*ModerationStatus.values, "attention"], required=False
    )
    edited = serializers.BooleanField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for key in ("recipient", "evaluator", "criterion"):
            if key in attrs:
                attrs[key] = str(attrs[key])
        lo, hi = attrs.get("rating_min"), attrs.get("rating_max")
        if lo is not None and hi is not None and lo > hi:
            raise serializers.ValidationError({"rating_max": ["Must be at least the minimum."]})
        return attrs


class ExportRequestSerializer(serializers.Serializer):
    report = serializers.ChoiceField(choices=REPORTS)
    file_type = serializers.ChoiceField(choices=FILE_TYPES)
    member = serializers.UUIDField(required=False)


# Responses -------------------------------------------------------------------
class ReportScaleSerializer(serializers.Serializer):
    type = serializers.CharField()
    min = _decimal()
    max = _decimal()
    step = _decimal()


class CriterionAggregateSerializer(serializers.Serializer):
    criterion = serializers.CharField()
    criterion_public_id = serializers.UUIDField()
    version = serializers.IntegerField()
    scale = ReportScaleSerializer()
    rated = serializers.IntegerField()
    not_rated = serializers.IntegerField()
    suppressed = serializers.BooleanField()
    average = _decimal()
    average_percent = _decimal()


class CycleRefSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField()


class ReportTrendPointSerializer(serializers.Serializer):
    cycle = CycleRefSerializer()
    evaluations = serializers.IntegerField()
    evaluators = serializers.IntegerField()
    suppressed = serializers.BooleanField()
    average_percent = _decimal()


class SectionAggregateSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    evaluations = serializers.IntegerField()
    recipients = serializers.IntegerField()
    evaluators = serializers.IntegerField()
    suppressed = serializers.BooleanField()
    average_percent = _decimal()


class TotalsSerializer(serializers.Serializer):
    evaluations = serializers.IntegerField()
    evaluators = serializers.IntegerField()
    recipients = serializers.IntegerField()


class ChoirSummarySerializer(serializers.Serializer):
    threshold = serializers.IntegerField()
    totals = TotalsSerializer()
    criteria = CriterionAggregateSerializer(many=True)
    voice_sections = SectionAggregateSerializer(many=True)
    trend = ReportTrendPointSerializer(many=True)


class ReportMemberSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    voice_section = serializers.CharField(allow_null=True)
    status = serializers.CharField()


class MemberSummarySerializer(serializers.Serializer):
    member = ReportMemberSerializer()
    evaluations_received = serializers.IntegerField()
    evaluations_given = serializers.IntegerField()
    criteria = CriterionAggregateSerializer(many=True)
    trend = ReportTrendPointSerializer(many=True)


class ParticipationCycleSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField()
    status = serializers.CharField()
    evaluation_scope = serializers.CharField()


class ParticipationTotalsSerializer(serializers.Serializer):
    possible_pairs = serializers.IntegerField()
    submitted_pairs = serializers.IntegerField()
    participating_members = serializers.IntegerField()
    participation_percent = serializers.FloatField(allow_null=True)


class ParticipationMemberSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    voice_section = serializers.CharField()
    is_evaluable = serializers.BooleanField()
    possible = serializers.IntegerField()
    given = serializers.IntegerField()
    received = serializers.IntegerField()
    percent = serializers.FloatField(allow_null=True)


class ParticipationReportSerializer(serializers.Serializer):
    cycle = ParticipationCycleSerializer()
    totals = ParticipationTotalsSerializer()
    members = ParticipationMemberSerializer(many=True)
