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
        .order_by()  # clear Meta.ordering, which would otherwise join the GROUP BY
        .values_list("status")
        .annotate(n=Count("id"))
    )
    return {status: counts.get(status, 0) for status in UserStatus.values}
