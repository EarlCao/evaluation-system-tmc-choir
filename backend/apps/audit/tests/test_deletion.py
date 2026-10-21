"""AUD-03 / ADR-022: confirmed deletion is privileged, atomic and itself recorded."""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import DEFAULT_PASSWORD, SuperAdminFactory, UserFactory
from apps.audit import services
from apps.audit.constants import CLEAR_CONFIRMATION, DELETION_EVENTS
from apps.audit.models import AuditLog
from apps.core.exceptions import PermissionDenied

pytestmark = pytest.mark.django_db


@pytest.fixture
def entry(member):
    return services.record(event_type="accounts.user.logged_in", actor=member)


def endpoint(entry, bulk=False):
    return reverse("audit-admin:logs") if bulk else reverse("audit-admin:log", args=[entry.pk])


def payload(**changes):
    return {"password": DEFAULT_PASSWORD, "reason": "Administrative cleanup", **changes}


@pytest.mark.parametrize("bulk", [False, True])
@pytest.mark.parametrize(
    "kind", ["anonymous", "member", "pending", "suspended", "deactivated", "inactive_admin"]
)
def test_only_active_super_admin_can_delete(entry, bulk, kind):
    client = APIClient()
    if kind != "anonymous":
        if kind == "inactive_admin":
            user = SuperAdminFactory(status="SUSPENDED")
        else:
            user = UserFactory(**({kind: True} if kind != "member" else {}))
        client.force_authenticate(user)
    response = client.delete(endpoint(entry, bulk), payload(confirmation=CLEAR_CONFIRMATION))
    assert response.status_code == (401 if kind == "anonymous" else 403)
    assert AuditLog.objects.filter(pk=entry.pk).exists()


@pytest.mark.parametrize("bulk", [False, True])
@pytest.mark.parametrize("changes", [{"password": "wrong"}, {"reason": " "}, {"password": ""}])
def test_bad_confirmation_does_not_remove_any_logs(entry, admin_client_api, bulk, changes):
    response = admin_client_api.delete(
        endpoint(entry, bulk), payload(confirmation=CLEAR_CONFIRMATION, **changes)
    )
    assert response.status_code == 400
    assert AuditLog.objects.filter(pk=entry.pk).exists()
    assert not AuditLog.objects.filter(event_type__in=DELETION_EVENTS).exists()


def test_single_delete_keeps_receipt_without_deleted_content(entry, admin_client_api, super_admin):
    other = services.record(event_type="private.content", metadata={"sensitive": "not copied"})
    response = admin_client_api.delete(endpoint(entry), payload(confirmation=""))
    assert response.status_code == 200
    assert response.json() == {"deleted": 1}
    assert not AuditLog.objects.filter(pk=entry.pk).exists()
    assert AuditLog.objects.filter(pk=other.pk).exists()
    receipt = AuditLog.objects.get(event_type=DELETION_EVENTS[0])
    assert receipt.actor_id == super_admin.pk
    assert receipt.target_id == str(entry.pk)
    assert receipt.metadata == {"deleted_count": 1, "reason": "Administrative cleanup"}
    assert DEFAULT_PASSWORD not in str(receipt.metadata)


def test_clear_all_requires_exact_typed_confirmation(entry, admin_client_api):
    for confirmation in ("", "DELETE", "delete all logs"):
        response = admin_client_api.delete(
            endpoint(entry, True), payload(confirmation=confirmation)
        )
        assert response.status_code == 400
        assert AuditLog.objects.filter(pk=entry.pk).exists()


def test_clear_all_keeps_old_receipts_and_records_new_action(entry, admin_client_api):
    receipt = services.record(event_type=DELETION_EVENTS[0], metadata={"deleted_count": 1})
    response = admin_client_api.delete(
        endpoint(entry, True), payload(confirmation=CLEAR_CONFIRMATION)
    )
    assert response.status_code == 200
    assert response.json() == {"deleted": 1}
    assert set(AuditLog.objects.values_list("event_type", flat=True)) == set(DELETION_EVENTS)
    assert AuditLog.objects.filter(pk=receipt.pk).exists()
    assert AuditLog.objects.get(event_type=DELETION_EVENTS[1]).metadata["deleted_count"] == 1


@pytest.mark.parametrize("event_type", DELETION_EVENTS)
def test_cannot_manually_delete_receipts(event_type, admin_client_api):
    receipt = services.record(event_type=event_type)
    assert admin_client_api.delete(endpoint(receipt), payload()).status_code == 409
    assert AuditLog.objects.filter(pk=receipt.pk).exists()


def test_missing_entry_is_not_found(entry, admin_client_api):
    url = reverse("audit-admin:log", args=[entry.pk + 100000])
    assert admin_client_api.delete(url, payload()).status_code == 404


def test_service_guards_against_non_admin_callers(entry, member):
    with pytest.raises(PermissionDenied):
        services.delete_logs(actor=member, pk=entry.pk, **payload())
    assert AuditLog.objects.filter(pk=entry.pk).exists()


@pytest.mark.parametrize("bulk", [False, True])
def test_receipt_failure_rolls_back_deletion(entry, super_admin, bulk):
    with (
        patch("apps.audit.services.record", side_effect=RuntimeError("receipt failed")),
        pytest.raises(RuntimeError),
    ):
        services.delete_logs(
            actor=super_admin,
            pk=None if bulk else entry.pk,
            **payload(confirmation=CLEAR_CONFIRMATION),
        )
    assert AuditLog.objects.filter(pk=entry.pk).exists()


@pytest.mark.parametrize("bulk", [False, True])
def test_delete_enforces_session_csrf(entry, super_admin, csrf_api_client, bulk):
    csrf_api_client.force_login(super_admin)
    assert (
        csrf_api_client.delete(
            endpoint(entry, bulk), payload(confirmation=CLEAR_CONFIRMATION)
        ).status_code
        == 403
    )
    assert AuditLog.objects.filter(pk=entry.pk).exists()


def test_password_guesses_are_rate_limited_without_throttling_read_access(entry, admin_client_api):
    for _ in range(5):
        assert (
            admin_client_api.delete(endpoint(entry), payload(password="wrong")).status_code == 400
        )
    assert admin_client_api.delete(endpoint(entry), payload()).status_code == 429
    assert admin_client_api.get(endpoint(entry)).status_code == 200
    assert AuditLog.objects.filter(pk=entry.pk).exists()


def test_confirmed_delete_with_valid_session_csrf_succeeds(entry, super_admin, csrf_api_client):
    csrf_api_client.force_login(super_admin)
    token = csrf_api_client.get(reverse("accounts:csrf")).json()["csrf_token"]
    response = csrf_api_client.delete(endpoint(entry), payload(), HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200
    assert not AuditLog.objects.filter(pk=entry.pk).exists()
    assert AuditLog.objects.filter(event_type=DELETION_EVENTS[0]).exists()
