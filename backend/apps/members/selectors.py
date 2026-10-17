"""Public read API of the members module."""

from collections.abc import Mapping
from uuid import UUID

from django.db.models import QuerySet

from apps.accounts.constants import UserStatus
from apps.core.exceptions import NotFound, ValidationError

from .filters import DirectoryFilter
from .models import MemberProfile, VoiceSection


def list_active_voice_sections() -> QuerySet[VoiceSection]:
    return VoiceSection.objects.filter(is_active=True)


def _active_profiles() -> QuerySet[MemberProfile]:
    """Profiles of ACTIVE accounts only (MEM-01). Super admins have no profile."""
    return MemberProfile.objects.filter(user__status=UserStatus.ACTIVE).select_related(
        "user", "voice_section"
    )


def list_directory(*, params: Mapping[str, str]) -> QuerySet[MemberProfile]:
    """MEM-01 / MEM-02: the choir directory, filtered and ordered by name."""
    filterset = DirectoryFilter(data=params, queryset=_active_profiles())
    if not filterset.is_valid():
        raise ValidationError(fields={k: list(v) for k, v in filterset.errors.items()})
    return filterset.qs.order_by("user__last_name", "user__first_name", "user__id")


def get_member_profile(*, public_id: UUID | str) -> MemberProfile:
    """MEM-03. Inactive members are reported as not found."""
    profile = _active_profiles().filter(user__public_id=public_id).first()
    if profile is None:
        raise NotFound()
    return profile


def get_own_profile(*, user) -> MemberProfile | None:
    return MemberProfile.objects.select_related("voice_section").filter(user=user).first()


def count_active_members() -> int:
    return _active_profiles().count()
