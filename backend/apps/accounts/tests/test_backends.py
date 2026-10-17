import pytest
from django.contrib.auth import authenticate

from apps.accounts.tests.factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory(username="Soprano_Q9", email="soprano.q9@example.org")


@pytest.mark.parametrize("identifier", ["Soprano_Q9", "soprano_q9", "SOPRANO.Q9@example.org"])
def test_login_with_username_or_email_case_insensitive(user, identifier):
    assert authenticate(username=identifier, password=DEFAULT_PASSWORD) == user


def test_wrong_password_fails(user):
    assert authenticate(username=user.username, password="wrong-password-1") is None


def test_unknown_identifier_fails():
    assert authenticate(username="nobody_q9", password=DEFAULT_PASSWORD) is None


@pytest.mark.parametrize("trait", ["pending", "suspended", "deactivated"])
def test_inactive_accounts_cannot_authenticate_even_with_correct_password(trait):
    user = UserFactory(**{trait: True})
    assert authenticate(username=user.username, password=DEFAULT_PASSWORD) is None
