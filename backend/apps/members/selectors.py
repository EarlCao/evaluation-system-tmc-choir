"""Public read API of the members module (directory selectors arrive in step 2.1)."""

from django.db.models import QuerySet

from .models import VoiceSection


def list_active_voice_sections() -> QuerySet[VoiceSection]:
    return VoiceSection.objects.filter(is_active=True)
