"""Step 4.6: System settings API (SET-01, SET-03)."""

import pytest
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.system.selectors import get_public_settings, get_settings

pytestmark = pytest.mark.django_db

URL = reverse("system-admin:settings")


def test_only_super_admins(api_client, member_client):
    assert api_client.get(URL).status_code == 401
    assert member_client.get(URL).status_code == 403
    assert member_client.patch(URL, {"choir_name": "x"}, format="json").status_code == 403


def test_read_and_update(admin_client_api, super_admin, django_capture_on_commit_callbacks):
    data = admin_client_api.get(URL).json()
    assert data["min_aggregate_group_size"] == 3
    assert data["min_comment_prompts"] == 5
    assert data["registration_mode"] == "APPROVAL"
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_client_api.patch(
            URL,
            {
                "choir_name": "St. Cecilia Choir",
                "privacy_notice": "Only the Super Admin sees who wrote an evaluation.",
                "min_aggregate_group_size": 4,
                "min_comment_prompts": 6,
                "time_zone": "Asia/Manila",
            },
            format="json",
        )
    assert response.status_code == 200, response.json()
    assert response.json()["choir_name"] == "St. Cecilia Choir"
    assert response.json()["min_comment_prompts"] == 6
    assert response.json()["updated_by"] == super_admin.get_full_name()
    assert get_settings().min_aggregate_group_size == 4  # cache invalidated after commit
    assert get_settings().min_comment_prompts == 6
    assert get_public_settings()["privacy_notice"].startswith("Only the Super Admin")
    assert get_public_settings()["min_comment_prompts"] == 6
    log = AuditLog.objects.get(event_type="system.settings.changed")
    assert log.after["min_aggregate_group_size"] == 4
    assert log.before["min_aggregate_group_size"] == 3
    assert log.after["min_comment_prompts"] == 6
    assert log.before["min_comment_prompts"] == 5


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"min_aggregate_group_size": 2}, "min_aggregate_group_size"),  # privacy floor (ADR-013)
        ({"min_comment_prompts": 0}, "min_comment_prompts"),
        ({"time_zone": "Mars/Olympus"}, "time_zone"),
        ({"registration_mode": "ANYONE"}, "registration_mode"),
        ({"retention_audit_days": 7}, "retention_audit_days"),
        ({"system_name": ""}, "system_name"),
    ],
)
def test_validation(admin_client_api, payload, field):
    response = admin_client_api.patch(URL, payload, format="json")
    assert response.status_code == 400
    assert field in response.json()["error"]["fields"]
    assert not AuditLog.objects.filter(event_type="system.settings.changed").exists()


def test_unchanged_values_write_nothing(admin_client_api, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        admin_client_api.patch(URL, {"min_aggregate_group_size": 3}, format="json")
    assert not AuditLog.objects.filter(event_type="system.settings.changed").exists()
