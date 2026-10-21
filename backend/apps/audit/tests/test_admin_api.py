"""Step 4.6: audit log viewer + export (AUD-03, AUD-04)."""

import csv
import io
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.audit import services
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def url(name, *args):
    return reverse(f"audit-admin:{name}", args=args)


@pytest.fixture
def logs(super_admin, member):
    # Append-only: an older entry can only be created with its time, never back-dated later.
    AuditLog.objects.create(
        event_type="accounts.user.logged_in",
        actor=member,
        actor_role=member.role,
        occurred_at=timezone.now() - timedelta(days=10),
    )
    services.record(
        event_type="evaluations.evaluation.submitted",
        actor=member,
        target_type="evaluations.Evaluation",
        target_id="abc-123",
    )
    services.record(
        event_type="system.settings.changed",
        actor=super_admin,
        before={"choir_name": ""},
        after={"choir_name": "=cmd|' /C calc'!A0"},
    )
    return AuditLog.objects.all()


@pytest.mark.parametrize("name", ["logs", "event-types", "export"])
def test_only_super_admins(api_client, member_client, name):
    assert api_client.get(url(name)).status_code == 401
    assert member_client.get(url(name)).status_code == 403


def test_read_only(logs, admin_client_api):
    """AUD-03: updates remain forbidden; deletion requires explicit confirmation (ADR-022)."""
    entry = logs.first()
    for method in ("put", "patch"):
        assert getattr(admin_client_api, method)(url("log", entry.pk), {}).status_code == 405
    assert admin_client_api.post(url("logs"), {}).status_code == 405
    assert admin_client_api.delete(url("log", entry.pk), {}).status_code == 400
    assert logs.filter(pk=entry.pk).exists()


def test_list_newest_first_with_actor(logs, admin_client_api, member):
    rows = admin_client_api.get(url("logs")).json()["results"]
    assert [r["event_type"] for r in rows] == [
        "system.settings.changed",
        "evaluations.evaluation.submitted",
        "accounts.user.logged_in",
    ]
    assert rows[1]["actor"]["public_id"] == str(member.public_id)
    assert rows[0]["after"] == {"choir_name": "=cmd|' /C calc'!A0"}


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ({"event_type": "evaluations."}, ["evaluations.evaluation.submitted"]),
        ({"event_type": "accounts.user.logged_in"}, ["accounts.user.logged_in"]),
        ({"search": "abc-123"}, ["evaluations.evaluation.submitted"]),
        ({"target_type": "evaluations.Evaluation"}, ["evaluations.evaluation.submitted"]),
        (
            {"occurred_from": "TODAY"},
            ["system.settings.changed", "evaluations.evaluation.submitted"],
        ),
    ],
)
def test_filters(logs, admin_client_api, query, expected):
    query = {k: timezone.now().date() if v == "TODAY" else v for k, v in query.items()}
    rows = admin_client_api.get(url("logs"), query).json()["results"]
    assert [r["event_type"] for r in rows] == expected


def test_actor_filter_and_validation(logs, admin_client_api, super_admin):
    rows = admin_client_api.get(url("logs"), {"actor": super_admin.public_id}).json()["results"]
    assert {r["event_type"] for r in rows} == {"system.settings.changed"}
    bad = admin_client_api.get(
        url("logs"), {"occurred_from": "2026-10-10", "occurred_to": "2026-10-01"}
    )
    assert bad.status_code == 400


def test_event_types(logs, admin_client_api):
    assert admin_client_api.get(url("event-types")).json() == [
        "accounts.user.logged_in",
        "evaluations.evaluation.submitted",
        "system.settings.changed",
    ]


def test_export_is_itself_audited_and_safe(logs, admin_client_api, super_admin):
    response = admin_client_api.get(url("export"), {"file_type": "csv", "event_type": "system."})
    assert response.status_code == 200
    assert 'filename="audit-log-' in response["Content-Disposition"]
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
    header = rows.index(next(r for r in rows if r and r[0] == "Time (UTC)"))
    data = rows[header + 1 :]
    assert len(data) == 1
    # JSON cells start with "{" (safe); a value starting with "=" would be prefixed.
    assert data[0][7].startswith("{")
    export = AuditLog.objects.get(event_type="audit.export.generated")
    assert export.actor == super_admin
    assert export.metadata == {"file_type": "csv", "filters": {"event_type": "system."}, "rows": 1}


def test_export_rejects_pdf(logs, admin_client_api):
    assert admin_client_api.get(url("export"), {"file_type": "pdf"}).status_code == 400
    assert not AuditLog.objects.filter(event_type="audit.export.generated").exists()
