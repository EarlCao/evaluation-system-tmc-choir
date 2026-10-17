from unittest import mock

import pytest
from django.core.management import call_command
from django.db import OperationalError
from django.urls import reverse


@pytest.mark.django_db
def test_health_ok(api_client):
    response = api_client.get(reverse("core:health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}
    assert "X-Request-ID" in response


@pytest.mark.django_db
def test_health_reports_database_failure_without_details(api_client):
    with mock.patch("apps.core.api.views.connection") as conn:
        conn.cursor.side_effect = OperationalError("Access denied for user 'choir'")
        response = api_client.get(reverse("core:health"))
    assert response.status_code == 503
    assert response.json() == {"status": "error", "db": "error"}


def test_schema_is_not_public_outside_dev(api_client):
    # Test settings keep the base default: SERVE_PERMISSIONS = IsSuperAdmin.
    assert api_client.get(reverse("schema")).status_code == 401
    assert api_client.get(reverse("swagger-ui")).status_code == 401


def test_openapi_schema_is_valid_without_warnings(tmp_path):
    call_command("spectacular", "--validate", "--fail-on-warn", "--file", tmp_path / "schema.yml")
    assert "/api/v1/health/" in (tmp_path / "schema.yml").read_text()
