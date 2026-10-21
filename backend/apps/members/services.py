"""Public write API of the members module."""

from django.db import transaction
from django.db.models import Max

from apps.accounts import services as account_services
from apps.core.events import publish
from apps.core.exceptions import NotFound, ValidationError

from .events import ProfileUpdated, VoiceSectionChanged
from .models import MemberProfile, VoiceSection

BIO_MAX_LENGTH = 500
OFFICER_POSITION_MAX_LENGTH = 100


def _clean_officer(is_officer: bool, officer_position: str) -> tuple[bool, str]:
    flag = bool(is_officer)
    pos = str(officer_position or "").strip() if flag else ""
    if flag and not pos:
        raise ValidationError(fields={"officer_position": ["Enter the officer position."]})
    if len(pos) > OFFICER_POSITION_MAX_LENGTH:
        raise ValidationError(
            fields={
                "officer_position": [f"Keep it under {OFFICER_POSITION_MAX_LENGTH} characters."]
            }
        )
    return flag, pos


def _create_member_profile_for_verified_user(
    user,
    voice_section_id: int,
    *,
    is_officer: bool = False,
    officer_position: str = "",
) -> MemberProfile:
    voice_section = VoiceSection.objects.filter(pk=voice_section_id, is_active=True).first()
    if voice_section is None:
        raise ValidationError(fields={"voice_section": ["Choose a valid voice section."]})
    flag, pos = _clean_officer(is_officer, officer_position)
    profile, _ = MemberProfile.objects.get_or_create(
        user=user,
        defaults={
            "voice_section": voice_section,
            "is_officer": flag,
            "officer_position": pos,
        },
    )
    return profile


account_services.register_profile_creator(_create_member_profile_for_verified_user)


def stage_member_registration(
    *,
    email: str,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    voice_section_id: int,
    is_officer: bool = False,
    officer_position: str = "",
) -> dict[str, str]:
    """Validate member registration and send 6-digit OTP email without creating the database
    account until the OTP is verified."""
    voice_section = VoiceSection.objects.filter(pk=voice_section_id, is_active=True).first()
    if voice_section is None:
        raise ValidationError(fields={"voice_section": ["Choose a valid voice section."]})
    flag, pos = _clean_officer(is_officer, officer_position)
    return account_services.stage_pending_registration(
        email=email,
        username=username,
        password=password,
        first_name=first_name,
        last_name=last_name,
        voice_section_id=voice_section.pk,
        is_officer=flag,
        officer_position=pos,
    )


def register_member(
    *,
    email: str,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    voice_section_id: int,
    is_officer: bool = False,
    officer_position: str = "",
):
    """AUTH-01: the registration use-case. Creates the account (status per
    ``registration_mode``) and the member profile atomically (ADR-004)."""
    voice_section = VoiceSection.objects.filter(pk=voice_section_id, is_active=True).first()
    if voice_section is None:
        raise ValidationError(fields={"voice_section": ["Choose a valid voice section."]})
    flag, pos = _clean_officer(is_officer, officer_position)

    with transaction.atomic():
        user = account_services.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        MemberProfile.objects.create(
            user=user,
            voice_section=voice_section,
            is_officer=flag,
            officer_position=pos,
        )
    return user


def send_registration_otp(user) -> None:
    """Send a registration OTP verification email via the accounts module."""
    account_services.send_verification_otp(user)


def create_active_member(
    *,
    actor,
    email: str,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    voice_section_id: int,
    is_officer: bool = False,
    officer_position: str = "",
):
    """An ACTIVE member with a profile, without the registration/approval flow (Super Admin
    or dev seed). Atomic like ``register_member``."""
    voice_section = VoiceSection.objects.filter(pk=voice_section_id, is_active=True).first()
    if voice_section is None:
        raise ValidationError(fields={"voice_section": ["Choose a valid voice section."]})
    flag, pos = _clean_officer(is_officer, officer_position)
    with transaction.atomic():
        user = account_services.create_active_member_account(
            actor=actor,
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        MemberProfile.objects.create(
            user=user,
            voice_section=voice_section,
            is_officer=flag,
            officer_position=pos,
        )
    return user


def update_own_profile(
    *,
    user,
    bio: str | None = None,
    is_officer: bool | None = None,
    officer_position: str | None = None,
) -> MemberProfile:
    """AUTH-04: members edit their own bio and officer status/position."""
    profile = MemberProfile.objects.filter(user=user).first()
    if profile is None:
        raise NotFound()
    changed_fields: list[str] = []
    if bio is not None:
        clean_bio = bio.strip()
        if len(clean_bio) > BIO_MAX_LENGTH:
            raise ValidationError(fields={"bio": [f"Keep it under {BIO_MAX_LENGTH} characters."]})
        if clean_bio != profile.bio:
            profile.bio = clean_bio
            changed_fields.append("bio")
    if is_officer is not None or officer_position is not None:
        next_flag = profile.is_officer if is_officer is None else bool(is_officer)
        next_pos = profile.officer_position if officer_position is None else str(officer_position)
        flag, pos = _clean_officer(next_flag, next_pos)
        if flag != profile.is_officer:
            profile.is_officer = flag
            changed_fields.append("is_officer")
        if pos != profile.officer_position:
            profile.officer_position = pos
            changed_fields.append("officer_position")
    if changed_fields:
        profile.save(update_fields=[*changed_fields, "updated_at"])
        publish(
            ProfileUpdated(
                actor_id=user.pk, target_id=user.pk, changed_fields=tuple(changed_fields)
            )
        )
    return profile


# ---------------------------------------------------------------------------
# Super Admin member management (step 4.2: AUTH-05, MEM-05, ADM-04). Account changes are
# delegated to accounts.services; profile and voice-section changes are owned here.
# ---------------------------------------------------------------------------
PROFILE_FIELDS = {
    "voice_section_id",
    "is_evaluable",
    "joined_choir_on",
    "is_officer",
    "officer_position",
}


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
    if "is_officer" in changes or "officer_position" in changes:
        next_flag = changes.get("is_officer", profile.is_officer)
        next_pos = changes.get("officer_position", profile.officer_position)
        flag, pos = _clean_officer(bool(next_flag), str(next_pos or ""))
        changes["is_officer"] = flag
        changes["officer_position"] = pos
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
