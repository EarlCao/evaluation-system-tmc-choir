"""Public read API of the accounts module."""

from uuid import UUID

from django.db.models import Count

from .constants import UserRole, UserStatus
from .models import User


def get_user_by_public_id(public_id: UUID | str) -> User | None:
    return User.objects.filter(public_id=public_id).first()


def count_members_by_status() -> dict[str, int]:
    """ADM-01: member accounts per status (Super Admins excluded)."""
    counts = dict(
        User.objects.filter(role=UserRole.MEMBER)
        .exclude(email__endswith="@invalid.local")
        .order_by()  # clear Meta.ordering, which would otherwise join the GROUP BY
        .values_list("status")
        .annotate(n=Count("id"))
    )
    return {status: counts.get(status, 0) for status in UserStatus.values}


def active_user_ids(*, role: str | None = None) -> list[int]:
    """Ids of ACTIVE accounts, optionally of one role (notification fan-out)."""
    qs = User.objects.filter(status=UserStatus.ACTIVE)
    if role:
        qs = qs.filter(role=role)
    return list(qs.order_by().values_list("id", flat=True))


def get_active_user(*, pk: int) -> User | None:
    return User.objects.filter(pk=pk, status=UserStatus.ACTIVE).first()


def get_user_by_pk(*, pk: int | str | None) -> User | None:
    return User.objects.filter(pk=pk).first() if pk else None


def username_taken(username: str) -> bool:
    return User.objects.filter(username__iexact=username).exists()
