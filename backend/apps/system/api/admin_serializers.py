from rest_framework import serializers

from ..constants import MIN_AGGREGATE_GROUP_SIZE_FLOOR, RegistrationMode
from ..models import SystemSettings

EDITABLE = [
    "system_name",
    "choir_name",
    "choir_description",
    "time_zone",
    "registration_mode",
    "min_aggregate_group_size",
    "feedback_notification_debounce_minutes",
    "privacy_notice",
    "retention_evaluations_days",
    "retention_revisions_days",
    "retention_audit_days",
]


class AdminSettingsSerializer(serializers.ModelSerializer):
    """SET-01 / SET-03: every editable setting, plus who changed them last."""

    updated_by = serializers.CharField(
        source="updated_by.get_full_name", allow_null=True, default=None
    )

    class Meta:
        model = SystemSettings
        fields = [*EDITABLE, "updated_at", "updated_by"]


class SettingsUpdateSerializer(serializers.Serializer):
    """Shape and range checks; the model's ``full_clean`` in the service is authoritative."""

    system_name = serializers.CharField(max_length=120, required=False)
    choir_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    choir_description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    time_zone = serializers.CharField(max_length=64, required=False)
    registration_mode = serializers.ChoiceField(choices=RegistrationMode.choices, required=False)
    min_aggregate_group_size = serializers.IntegerField(
        min_value=MIN_AGGREGATE_GROUP_SIZE_FLOOR, max_value=50, required=False
    )
    feedback_notification_debounce_minutes = serializers.IntegerField(
        min_value=0, max_value=1440, required=False
    )
    privacy_notice = serializers.CharField(max_length=10000, required=False)
    retention_evaluations_days = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )
    retention_revisions_days = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )
    retention_audit_days = serializers.IntegerField(min_value=30, required=False, allow_null=True)
