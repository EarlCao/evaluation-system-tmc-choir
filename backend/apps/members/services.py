"""Public write API of the members module."""

from django.db import transaction
from django.db.models import Max

from apps.accounts import services as account_services
from apps.core.events import publish
from apps.core.exceptions import NotFound, ValidationError

from .events import ProfileUpdated, VoiceSectionChanged
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


# ---------------------------------------------------------------------------
# Super Admin member management (step 4.2: AUTH-05, MEM-05, ADM-04). Account changes are
# delegated to accounts.services; profile and voice-section changes are owned here.
# ---------------------------------------------------------------------------
PROFILE_FIELDS = {"voice_section_id", "is_evaluable", "joined_choir_on"}


def admin_update_profile(*, actor, profile: MemberProfile, **changes) -> MemberProfile:
    unknown = set(changes) - PROFILE_FIELDS
    if unknown:
        raise ValidationError(
            fields={f: ["This field cannot be changed."] for f in sorted(unknown)}
        )
    if (
        "voice_section_id" in changes
        and not VoiceSection.objects.filter(pk=changes["voice_section_id"], is_active=True).exists()
    ):
        raise ValidationError(fields={"voice_section": ["Choose an active voice section."]})
    diff = tuple(
        (field, str(getattr(profile, field)), str(value))
        for field, value in sorted(changes.items())
        if getattr(profile, field) != value
    )
    if diff:
        for field in changes:
            setattr(profile, field, changes[field])
        profile.save()
        publish(
            ProfileUpdated(
                actor_id=actor.pk,
                target_id=profile.user_id,
                changed_fields=tuple(f for f, _o, _n in diff),
                changes=diff,
            )
        )
    return profile


def approve(*, actor, user):
    return account_services.approve_user(actor=actor, user=user)


def set_status(*, actor, user, status: str, reason: str = ""):
    return account_services.set_user_status(actor=actor, user=user, status=status, reason=reason)


def set_role(*, actor, user, role: str):
    return account_services.set_user_role(actor=actor, user=user, role=role)


def send_password_reset(*, actor, user) -> None:
    account_services.send_password_reset(actor=actor, user=user)


# Voice sections ----------------------------------------------------------------------------
def create_voice_section(*, actor, name: str) -> VoiceSection:
    name = name.strip()
    if not name or VoiceSection.objects.filter(name__iexact=name).exists():
        raise ValidationError(fields={"name": ["Enter a unique name."]})
    with transaction.atomic():
        order = (VoiceSection.objects.aggregate(m=Max("sort_order"))["m"] or 0) + 1
        section = VoiceSection.objects.create(name=name, sort_order=order)
        publish(VoiceSectionChanged(actor_id=actor.pk, target_id=section.pk, action="created"))
    return section


def update_voice_section(*, actor, section: VoiceSection, **changes) -> VoiceSection:
    allowed = {"name", "sort_order", "is_active"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValidationError(
            fields={f: ["This field cannot be changed."] for f in sorted(unknown)}
        )
    if "name" in changes:
        changes["name"] = str(changes["name"]).strip()
        clash = VoiceSection.objects.filter(name__iexact=changes["name"]).exclude(pk=section.pk)
        if not changes["name"] or clash.exists():
            raise ValidationError(fields={"name": ["Enter a unique name."]})
    diff = tuple(
        (f, getattr(section, f), v) for f, v in sorted(changes.items()) if getattr(section, f) != v
    )
    if diff:
        for field, _old, new in diff:
            setattr(section, field, new)
        section.save()
        publish(
            VoiceSectionChanged(
                actor_id=actor.pk, target_id=section.pk, action="updated", changes=diff
            )
        )
    return section
