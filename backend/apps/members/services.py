"""Public write API of the members module."""

from django.db import transaction

from apps.accounts import services as account_services
from apps.core.events import publish
from apps.core.exceptions import NotFound, ValidationError

from .events import ProfileUpdated
from .models import MemberProfile, VoiceSection

BIO_MAX_LENGTH = 500


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


def update_own_profile(*, user, bio: str) -> MemberProfile:
    """AUTH-04: members edit their own bio. Voice section and evaluability are managed by
    the Super Admin (MEM-05, step 4.2)."""
    profile = MemberProfile.objects.filter(user=user).first()
    if profile is None:
        raise NotFound()
    bio = bio.strip()
    if len(bio) > BIO_MAX_LENGTH:
        raise ValidationError(fields={"bio": [f"Keep it under {BIO_MAX_LENGTH} characters."]})
    if bio != profile.bio:
        profile.bio = bio
        profile.save(update_fields=["bio", "updated_at"])
        publish(ProfileUpdated(actor_id=user.pk, target_id=user.pk, changed_fields=("bio",)))
    return profile
