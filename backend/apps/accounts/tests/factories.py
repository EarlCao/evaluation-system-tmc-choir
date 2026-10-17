import factory
from factory.django import DjangoModelFactory, Password

from apps.accounts.constants import UserRole, UserStatus
from apps.accounts.models import User

DEFAULT_PASSWORD = "Melodic-Harmony-2026"  # gitleaks:allow (fake test password)


class UserFactory(DjangoModelFactory):
    """An ACTIVE member. Names/usernames contain unique tokens so privacy assertions
    (assert_no_evaluator_leak) never collide with ordinary words."""

    class Meta:
        model = User
        django_get_or_create = ("username",)

    username = factory.Sequence(lambda n: f"member_zq{n:04d}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.org")
    first_name = factory.Sequence(lambda n: f"Quorvin{n:04d}")
    last_name = factory.Sequence(lambda n: f"Zelphar{n:04d}")
    role = UserRole.MEMBER
    status = UserStatus.ACTIVE
    password = Password(DEFAULT_PASSWORD)

    class Params:
        pending = factory.Trait(status=UserStatus.PENDING)
        suspended = factory.Trait(status=UserStatus.SUSPENDED)
        deactivated = factory.Trait(status=UserStatus.DEACTIVATED)


class SuperAdminFactory(UserFactory):
    username = factory.Sequence(lambda n: f"admin_zq{n:04d}")
    role = UserRole.SUPER_ADMIN
    is_staff = True
    is_superuser = True
