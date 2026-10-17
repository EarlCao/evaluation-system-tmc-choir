"""Public read API of the accounts module."""

from uuid import UUID

from .models import User


def get_user_by_public_id(public_id: UUID | str) -> User | None:
    return User.objects.filter(public_id=public_id).first()
