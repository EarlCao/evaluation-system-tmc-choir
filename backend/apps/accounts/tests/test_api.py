import re

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.constants import UserRole, UserStatus
from apps.accounts.tests.factories import DEFAULT_PASSWORD, UserFactory
from apps.accounts.tokens import email_verification_token, encode_uid

pytestmark = pytest.mark.django_db

URL = {
    name: reverse(f"accounts:{name}")
    for name in [
        "csrf",
        "login",
        "logout",
        "me",
        "password-change",
        "password-reset",
        "password-reset-confirm",
        "verify-email",
    ]
}

ME_FIELDS = {
    "public_id",
    "username",
    "email",
    "first_name",
    "last_name",
    "display_name",
    "role",
    "status",
    "is_super_admin",
    "email_verified",
    "date_joined",
}


def csrf_client() -> APIClient:
    """A browser-like client: fetches the CSRF cookie and sends it back as a header."""
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(URL["csrf"])
    client.credentials(HTTP_X_CSRFTOKEN=response.cookies["csrftoken"].value)
    return client


def test_csrf_endpoint_sets_cookie(api_client):
    response = api_client.get(URL["csrf"])
    assert response.status_code == 200
    assert "csrftoken" in response.cookies


def test_login_returns_me_payload_and_starts_session():
    user = UserFactory()
    client = csrf_client()
    response = client.post(
        URL["login"], {"identifier": user.username, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    assert set(response.json()) == ME_FIELDS | {"csrf_token"}
    assert response.json()["csrf_token"]
    assert "password" not in response.content.decode()
    assert client.get(URL["me"]).json()["username"] == user.username


def test_login_requires_csrf_token():
    user = UserFactory()
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(
        URL["login"], {"identifier": user.username, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


@pytest.mark.parametrize(
    "case", ["wrong_password", "unknown_user", "pending", "suspended", "deactivated"]
)
def test_login_failures_are_indistinguishable(case):
    user = UserFactory(**({case: True} if case in {"pending", "suspended", "deactivated"} else {}))
    response = csrf_client().post(
        URL["login"],
        {
            "identifier": "ghost_q1" if case == "unknown_user" else user.username,
            "password": "wrong-password-9" if case == "wrong_password" else DEFAULT_PASSWORD,
        },
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "invalid_credentials",
            "message": "Invalid credentials or account not active.",
        }
    }


def test_login_is_throttled_per_identifier():
    """Security Model: 5/min per IP + identifier."""
    UserFactory(username="target_q1")
    client = csrf_client()
    codes = [
        client.post(
            URL["login"], {"identifier": "target_q1", "password": "bad-guess-000"}
        ).status_code
        for _ in range(6)
    ]
    assert codes == [400] * 5 + [429]
    # a different identifier from the same IP is not blocked
    other = client.post(URL["login"], {"identifier": "someone_else", "password": "x"})
    assert other.status_code == 400


def test_me_requires_authentication(api_client):
    response = api_client.get(URL["me"])
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_me_patch_updates_names_but_ignores_role_and_status(member_client, member):
    response = member_client.patch(
        URL["me"],
        {
            "first_name": "Rina",
            "role": UserRole.SUPER_ADMIN,
            "status": "ACTIVE",
            "email": "evil@example.org",
        },
    )
    assert response.status_code == 200
    member.refresh_from_db()
    assert member.first_name == "Rina"
    assert member.role == UserRole.MEMBER
    assert member.email != "evil@example.org"


def test_suspended_users_existing_session_stops_working(member_client, member):
    assert member_client.get(URL["me"]).status_code == 200
    member.status = UserStatus.SUSPENDED
    member.save()
    assert member_client.get(URL["me"]).status_code == 401


def test_logout_ends_session(member_client):
    assert member_client.post(URL["logout"]).status_code == 204
    assert member_client.get(URL["me"]).status_code == 401


def test_password_change_api(member_client, member):
    response = member_client.post(
        URL["password-change"],
        {
            "old_password": DEFAULT_PASSWORD,
            "new_password": "Fresh-Harmony-2027",  # gitleaks:allow (fake test password)
        },
    )
    assert response.status_code == 200
    member.refresh_from_db()
    assert member.check_password("Fresh-Harmony-2027")
    assert member_client.get(URL["me"]).status_code == 200  # current session kept


def test_password_reset_api_gives_identical_answer_for_known_and_unknown(
    django_capture_on_commit_callbacks,
):
    UserFactory(email="known.q1@example.org")
    client = csrf_client()
    with django_capture_on_commit_callbacks(execute=True):
        known = client.post(URL["password-reset"], {"email": "known.q1@example.org"})
        unknown = client.post(URL["password-reset"], {"email": "nobody.q1@example.org"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(mail.outbox) == 1


def test_password_reset_confirm_api(django_capture_on_commit_callbacks):
    user = UserFactory(email="confirm.q1@example.org")
    client = csrf_client()
    with django_capture_on_commit_callbacks(execute=True):
        client.post(URL["password-reset"], {"email": user.email})
    uid, token = re.search(r"/reset-password/([^/]+)/([^/\s]+)", mail.outbox[0].body).groups()

    response = client.post(
        URL["password-reset-confirm"],
        {"uid": uid, "token": token, "new_password": "Reset-Chorale-55"},
    )
    assert response.status_code == 200
    bad = client.post(
        URL["password-reset-confirm"],
        {"uid": uid, "token": token, "new_password": "Reset-Chorale-56"},
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["fields"] == {"token": ["This link is invalid or has expired."]}


def test_password_reset_is_throttled():
    client = csrf_client()
    codes = [
        client.post(URL["password-reset"], {"email": f"x{i}@example.org"}).status_code
        for i in range(4)
    ]
    assert codes == [202, 202, 202, 429]


def test_verify_email_api(registration_mode):
    registration_mode("EMAIL_VERIFICATION")
    user = UserFactory(pending=True)
    response = csrf_client().post(
        URL["verify-email"],
        {
            "uid": encode_uid(user),
            "token": email_verification_token.make_token(user),
        },
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.status == UserStatus.ACTIVE
