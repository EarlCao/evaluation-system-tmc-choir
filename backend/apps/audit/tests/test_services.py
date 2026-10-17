import pytest

from apps.audit import services
from apps.audit.services import REDACTED
from apps.core.middleware import RequestContext, request_context

pytestmark = pytest.mark.django_db


def test_record_stores_all_fields(actor):
    """AUD-02: actor, action, affected record, timestamp, before/after."""
    entry = services.record(
        event_type="accounts.user.role_changed",
        actor=actor,
        target_type="accounts.User",
        target_id=42,
        before={"role": "MEMBER"},
        after={"role": "SUPER_ADMIN"},
        metadata={"reason": "promotion"},
    )
    entry.refresh_from_db()
    assert entry.actor == actor
    assert entry.event_type == "accounts.user.role_changed"
    assert entry.target_type == "accounts.User"
    assert entry.target_id == "42"
    assert entry.before == {"role": "MEMBER"}
    assert entry.after == {"role": "SUPER_ADMIN"}
    assert entry.metadata == {"reason": "promotion"}
    assert entry.occurred_at is not None


def test_actor_is_resolved_from_actor_id(actor):
    assert services.record(event_type="x.y.z", actor_id=actor.pk).actor == actor


def test_unknown_actor_id_records_without_actor():
    entry = services.record(event_type="x.y.z", actor_id=987654)
    assert entry.actor is None


def test_actor_role_is_snapshotted(actor):
    actor.role = "SUPER_ADMIN"  # accounts.User provides .role from step 1.4
    assert services.record(event_type="x.y.z", actor=actor).actor_role == "SUPER_ADMIN"


def test_request_context_is_captured():
    ctx = RequestContext(request_id="a" * 32, ip_address="203.0.113.7", user_agent="pytest")
    with request_context(ctx):
        entry = services.record(event_type="accounts.user.logged_in")
    assert (entry.ip_address, entry.user_agent, entry.request_id) == (
        "203.0.113.7",
        "pytest",
        "a" * 32,
    )


def test_no_request_context_outside_requests():
    entry = services.record(event_type="system.job.ran")
    assert (entry.ip_address, entry.user_agent, entry.request_id) == (None, "", "")


def test_secrets_are_redacted_recursively():
    """AUD-02 / Audit note: never store passwords or tokens."""
    entry = services.record(
        event_type="accounts.password.reset_requested",
        before={"password": "old-pw", "email": "a@example.org"},
        after={"new_password1": "x", "profile": {"api_key": "k", "name": "Ann"}},
        metadata={"tokens": [{"reset_token": "t"}], "changed_keys": ["email"]},
    )
    entry.refresh_from_db()
    assert entry.before == {"password": REDACTED, "email": "a@example.org"}
    assert entry.after == {
        "new_password1": REDACTED,
        "profile": {"api_key": REDACTED, "name": "Ann"},
    }
    assert entry.metadata == {"tokens": REDACTED, "changed_keys": ["email"]}
