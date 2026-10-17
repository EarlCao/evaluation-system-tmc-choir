import uuid

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.constants import UserRole, UserStatus
from apps.accounts.models import User
from apps.accounts.tests.factories import SuperAdminFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_custom_user_model_is_active():
    assert get_user_model() is User


def test_create_user_normalises_email_and_defaults_to_pending_member():
    user = User.objects.create_user(
        email="Alto.Singer@Example.ORG",
        username="alto_q1",
        password="x" * 12,
        first_name="A",
        last_name="S",
    )
    assert user.email == "alto.singer@example.org"
    assert user.role == UserRole.MEMBER
    assert user.status == UserStatus.PENDING
    assert not user.is_staff
    assert isinstance(user.public_id, uuid.UUID)
    assert user.check_password("x" * 12)


def test_create_superuser_is_active_super_admin_with_admin_access():
    user = User.objects.create_superuser(
        email="root@example.org",
        username="root_q1",
        password="x" * 12,
        first_name="R",
        last_name="T",
    )
    assert (user.role, user.status) == (UserRole.SUPER_ADMIN, UserStatus.ACTIVE)
    assert user.is_staff
    assert user.is_superuser


@pytest.mark.parametrize(
    ("status", "active"),
    [
        (UserStatus.ACTIVE, True),
        (UserStatus.PENDING, False),
        (UserStatus.SUSPENDED, False),
        (UserStatus.DEACTIVATED, False),
    ],
)
def test_activity_flags_follow_status(status, active):
    member = UserFactory(status=status)
    admin = SuperAdminFactory(status=status)
    assert member.is_active is active
    assert member.is_active_member is active
    assert member.is_super_admin is False
    assert admin.is_super_admin is active


def test_names():
    user = UserFactory(first_name="Ana", last_name="Reyes", display_name="")
    assert user.get_full_name() == "Ana Reyes"
    assert user.get_short_name() == "Ana"
    user.display_name = "Annie"
    assert user.get_short_name() == "Annie"
