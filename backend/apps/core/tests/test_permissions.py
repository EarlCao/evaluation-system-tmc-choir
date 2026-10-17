from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser

from apps.core.permissions import IsActiveMember, IsSuperAdmin


def user(*, active: bool, super_admin: bool = False):
    return SimpleNamespace(
        is_authenticated=True, is_active_member=active, is_super_admin=super_admin
    )


CASES = {
    "anonymous": AnonymousUser(),
    "inactive_member": user(active=False),
    "member": user(active=True),
    "inactive_super_admin": user(active=False, super_admin=True),
    "super_admin": user(active=True, super_admin=True),
    "object_without_role_properties": SimpleNamespace(is_authenticated=True),
}


@pytest.mark.parametrize(
    ("case", "expected"),
    [
        ("anonymous", False),
        ("inactive_member", False),
        ("member", True),
        ("inactive_super_admin", False),
        ("super_admin", True),
        ("object_without_role_properties", False),
    ],
)
def test_is_active_member(case, expected):
    request = SimpleNamespace(user=CASES[case])
    assert IsActiveMember().has_permission(request, view=None) is expected


@pytest.mark.parametrize(
    ("case", "expected"),
    [
        ("anonymous", False),
        ("inactive_member", False),
        ("member", False),
        ("inactive_super_admin", False),
        ("super_admin", True),
        ("object_without_role_properties", False),
    ],
)
def test_is_super_admin(case, expected):
    request = SimpleNamespace(user=CASES[case])
    assert IsSuperAdmin().has_permission(request, view=None) is expected
