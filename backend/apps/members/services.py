"""Public write API of the members module."""

from django.db import transaction

from apps.accounts import services as account_services
from apps.core.exceptions import ValidationError

from .models import MemberProfile, VoiceSection


def register_member(
    *,
    email: str,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    voice_section_id: int,
):
    """AUTH-01: the registration use-case. Creates the account (status per
    ``registration_mode``) and the member profile atomically (ADR-004)."""
    voice_section = VoiceSection.objects.filter(pk=voice_section_id, is_active=True).first()
    if voice_section is None:
        raise ValidationError(fields={"voice_section": ["Choose a valid voice section."]})

    with transaction.atomic():
        user = account_services.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        MemberProfile.objects.create(user=user, voice_section=voice_section)
    return user
