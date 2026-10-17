from rest_framework import serializers

from ..models import VoiceSection


class VoiceSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceSection
        fields = ["id", "name"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    username = serializers.RegexField(r"^[\w.@+-]+\Z", max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    voice_section = serializers.IntegerField(min_value=1)


class RegistrationResultSerializer(serializers.Serializer):
    status = serializers.CharField()
    detail = serializers.CharField()
