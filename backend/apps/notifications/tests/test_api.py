"""Step 5.1: Notification model, services and REST API (RT-01, RT-05, RT-06)."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.core.exceptions import NotFound, ValidationError
from apps.notifications import selectors, services
from apps.notifications.constants import NotificationType

pytestmark = pytest.mark.django_db


def note(user, message="You have new feedback.", link="/app/feedback"):
    return services.notify(
        recipient=user, type=NotificationType.FEEDBACK_AVAILABLE, message=message, link=link
    )


@pytest.mark.parametrize(
    ("kwargs", "field"),
    [
        ({"type": "SPAM"}, "type"),
        ({"message": "   "}, "message"),
        ({"message": "x" * 201}, "message"),
        ({"link": "https://evil.example/"}, "link"),
        ({"link": "//evil.example/"}, "link"),
    ],
)
def test_notify_validation(member, kwargs, field):
    values = {
        "recipient": member,
        "type": NotificationType.CYCLE_OPENED,
        "message": "The period is open.",
        "link": "/app",
        **kwargs,
    }
    with pytest.raises(ValidationError) as exc:
        services.notify(**values)
    assert field in exc.value.fields


def test_anonymous_is_refused(api_client):
    assert api_client.get(reverse("notifications:list")).status_code == 401
    assert api_client.get(reverse("notifications:unread-count")).status_code == 401


def test_suspended_users_are_refused(member):
    suspended = UserFactory(suspended=True)
    client = APIClient()
    client.force_login(suspended)
    assert client.get(reverse("notifications:list")).status_code in (401, 403)


def test_list_only_own_newest_first(member, member_client):
    other = UserFactory()
    first = note(member, "The period is open.")
    second = note(member)
    note(other, "Someone else's.")
    rows = member_client.get(reverse("notifications:list")).json()["results"]
    assert [r["public_id"] for r in rows] == [str(second.public_id), str(first.public_id)]
    assert set(rows[0]) == {
        "public_id",
        "type",
        "message",
        "link",
        "is_read",
        "read_at",
        "created_at",
    }


def test_unread_count_and_mark_read(member, member_client):
    a, _b = note(member), note(member)
    url = reverse("notifications:unread-count")
    assert member_client.get(url).json() == {"unread": 2}
    response = member_client.post(reverse("notifications:read", args=[a.public_id]))
    assert response.status_code == 200
    assert response.json()["is_read"] is True
    assert member_client.get(url).json() == {"unread": 1}
    unread = member_client.get(reverse("notifications:list"), {"unread": "true"}).json()
    assert unread["count"] == 1
    assert member_client.post(reverse("notifications:read-all")).json() == {"marked": 1}
    assert selectors.unread_count(user=member) == 0


def test_cannot_touch_someone_elses_notification(member, member_client):
    theirs = note(UserFactory())
    response = member_client.post(reverse("notifications:read", args=[theirs.public_id]))
    assert response.status_code == 404
    with pytest.raises(NotFound):
        services.mark_read(user=member, public_id=theirs.public_id)
    theirs.refresh_from_db()
    assert theirs.is_read is False


def test_asgi_application_routes_http_and_websocket():
    from config.asgi import application

    assert set(application.application_mapping) == {"http", "websocket"}
