"""Public read API of the members module."""

from collections.abc import Mapping
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q, QuerySet, Subquery, TextField, Value
from django.db.models.functions import Coalesce

from apps.accounts.constants import UserStatus
from apps.core.exceptions import NotFound, ValidationError
from apps.evaluations.constants import CycleStatus, EvaluationStatus, ModerationStatus
from apps.evaluations.models import Evaluation, EvaluationComment

from .filters import DirectoryFilter
from .models import MemberProfile, VoiceSection


def list_active_voice_sections() -> QuerySet[VoiceSection]:
    return VoiceSection.objects.filter(is_active=True)


def active_profiles() -> QuerySet[MemberProfile]:
    """Profiles of ACTIVE accounts only (MEM-01). Super admins have no profile."""
    self_eval_qs = (
        Evaluation.objects.filter(
            evaluator_id=OuterRef("user_id"),
            recipient_id=OuterRef("user_id"),
            status=EvaluationStatus.SUBMITTED,
        )
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .exclude(cycle__status=CycleStatus.DRAFT)
    )
    self_comment_qs = (
        EvaluationComment.objects.filter(
            evaluation__evaluator_id=OuterRef("user_id"),
            evaluation__recipient_id=OuterRef("user_id"),
            evaluation__status=EvaluationStatus.SUBMITTED,
        )
        .exclude(evaluation__moderation_status=ModerationStatus.HIDDEN)
        .exclude(evaluation__cycle__status=CycleStatus.DRAFT)
        .exclude(moderation_status=ModerationStatus.HIDDEN)
        .order_by("-evaluation__cycle__is_current", "-evaluation__submitted_at", "order", "id")
        .values("body")[:1]
    )
    return (
        MemberProfile.objects.filter(user__status=UserStatus.ACTIVE)
        .select_related("user", "voice_section")
        .annotate(
            has_self_evaluation=Exists(self_eval_qs),
            self_evaluation_summary=Coalesce(
                Subquery(self_comment_qs, output_field=TextField()),
                Value("", output_field=TextField()),
                output_field=TextField(),
            ),
        )
    )


def list_directory(*, params: Mapping[str, str]) -> QuerySet[MemberProfile]:
    """MEM-01 / MEM-02: the choir directory, filtered and ordered by name."""
    filterset = DirectoryFilter(data=params, queryset=active_profiles())
    if not filterset.is_valid():
        raise ValidationError(fields={k: list(v) for k, v in filterset.errors.items()})
    return filterset.qs.order_by("user__last_name", "user__first_name", "user__id")


def get_member_profile(*, public_id: UUID | str) -> MemberProfile:
    """MEM-03. Inactive members are reported as not found."""
    profile = active_profiles().filter(user__public_id=public_id).first()
    if profile is None:
        raise NotFound()
    return profile


def get_own_profile(*, user) -> MemberProfile | None:
    return MemberProfile.objects.select_related("voice_section").filter(user=user).first()


def count_active_members() -> int:
    return active_profiles().count()


# Super Admin views (step 4.2) -------------------------------------------------------------
ADMIN_FILTERS = {"status", "role", "voice_section"}


def admin_list_members(
    *, search: str = "", status: str = "", role: str = "", voice_section: str = ""
):
    """All accounts (members and Super Admins) with their choir profile, if any. Read-only
    composite of accounts.User + MemberProfile; writes go through the owning services."""
    qs = (
        get_user_model()
        .objects.select_related("member_profile__voice_section")
        .exclude(email__endswith="@invalid.local")
    )
    for term in search.split():
        qs = qs.filter(
            Q(first_name__icontains=term)
            | Q(last_name__icontains=term)
            | Q(display_name__icontains=term)
            | Q(username__icontains=term)
            | Q(email__icontains=term)
        )
    if status:
        qs = qs.filter(status=status)
    if role:
        qs = qs.filter(role=role)
    if voice_section:
        qs = qs.filter(member_profile__voice_section_id=voice_section)
    return qs.order_by("last_name", "first_name", "id")


def admin_get_member(*, public_id: UUID | str):
    user = (
        get_user_model()
        .objects.select_related("member_profile__voice_section", "approved_by")
        .filter(public_id=public_id)
        .first()
    )
    if user is None:
        raise NotFound()
    return user


def admin_list_voice_sections() -> QuerySet[VoiceSection]:
    return VoiceSection.objects.all()
