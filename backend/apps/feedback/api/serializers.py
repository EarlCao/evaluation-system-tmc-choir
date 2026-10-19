"""Recipient-facing serializers. Explicit fields only; nothing here can reach an Evaluation
instance or its evaluator (Privacy Model)."""

from rest_framework import serializers

_decimal = {"max_digits": 6, "decimal_places": 2, "coerce_to_string": False}


class FeedbackCycleSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    name = serializers.CharField()


class FeedbackCommentEntrySerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    body = serializers.CharField()


class FeedbackItemSerializer(serializers.Serializer):
    feedback_id = serializers.CharField()
    cycle = FeedbackCycleSerializer()
    date = serializers.DateField()
    is_edited = serializers.BooleanField()
    comment = serializers.CharField()
    suggestion = serializers.CharField()
    comments = FeedbackCommentEntrySerializer(many=True)


class ScaleSerializer(serializers.Serializer):
    type = serializers.CharField()
    min = serializers.DecimalField(**_decimal)
    max = serializers.DecimalField(**_decimal)
    step = serializers.DecimalField(**_decimal)


class CriterionSummarySerializer(serializers.Serializer):
    criterion = serializers.CharField()
    criterion_public_id = serializers.UUIDField()
    scale = ScaleSerializer()
    n = serializers.IntegerField()
    suppressed = serializers.BooleanField()
    average = serializers.DecimalField(allow_null=True, **_decimal)
    distribution = serializers.DictField(child=serializers.IntegerField(), allow_null=True)


class TrendPointSerializer(serializers.Serializer):
    cycle = FeedbackCycleSerializer()
    evaluations = serializers.IntegerField()
    suppressed = serializers.BooleanField()
    average_percent = serializers.DecimalField(allow_null=True, **_decimal)


class FeedbackSummarySerializer(serializers.Serializer):
    evaluations_received = serializers.IntegerField()
    threshold = serializers.IntegerField()
    criteria = CriterionSummarySerializer(many=True)
    trend = TrendPointSerializer(many=True)


class FeedbackCountSerializer(serializers.Serializer):
    evaluations_received = serializers.IntegerField()
