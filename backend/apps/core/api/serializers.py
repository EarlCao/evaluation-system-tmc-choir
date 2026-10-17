from rest_framework import serializers

# Shared choice set; named once in the schema via SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"].
HEALTH_STATES = [("ok", "ok"), ("error", "error")]


class HealthSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=HEALTH_STATES)
    db = serializers.ChoiceField(choices=HEALTH_STATES)
