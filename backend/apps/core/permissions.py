"""Shared DRF permission classes (Roles and Permissions).

``core`` must not import ``accounts`` (dependency direction), so these checks rely on
two properties that ``accounts.User`` provides:

- ``is_active_member``: account status is ACTIVE (any role)
- ``is_super_admin``: role is SUPER_ADMIN and status is ACTIVE
"""

from rest_framework.permissions import BasePermission


def _is_authenticated(user) -> bool:
    return bool(user and user.is_authenticated)


class IsActiveMember(BasePermission):
    """Default for every endpoint: an authenticated user whose account is ACTIVE."""

    message = "Your account is not active."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return _is_authenticated(user) and bool(getattr(user, "is_active_member", False))


class IsSuperAdmin(BasePermission):
    """Required on every view under /api/v1/admin/."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return (
            _is_authenticated(user)
            and bool(getattr(user, "is_active_member", False))
            and bool(getattr(user, "is_super_admin", False))
        )
