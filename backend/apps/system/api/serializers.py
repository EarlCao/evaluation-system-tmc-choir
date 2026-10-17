from rest_framework import serializers


class PublicSettingsSerializer(serializers.Serializer):
    system_name = serializers.CharField()
    choir_name = serializers.CharField()
    choir_description = serializers.CharField()
    privacy_notice = serializers.CharField()
    registration_mode = serializers.CharField()
