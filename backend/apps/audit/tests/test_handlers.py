from dataclasses import dataclass
from typing import Any, ClassVar

import pytest
from django.db import transaction

from apps.audit.handlers import record_domain_event
from apps.audit.models import AuditLog
from apps.core import events
from apps.core.events import DomainEvent, publish
from apps.core.middleware import RequestContext, request_context
from apps.system import services as system_services

pytestmark = pytest.mark.django_db


@dataclass(frozen=True, kw_only=True)
class MemberSuspended(DomainEvent):
    name = "audit_tests.user.suspended"
    target_type = "accounts.User"
    reason: str


@dataclass(frozen=True, kw_only=True)
class ThingConfigured(DomainEvent):
    name = "audit_tests.thing.configured"
    changes: tuple[tuple[str, Any, Any], ...]


@dataclass(frozen=True, kw_only=True)
class NotWorthAuditing(DomainEvent):
    name = "audit_tests.noise.happened"
    audited: ClassVar[bool] = False


def test_handler_is_registered_for_every_event():
    assert record_domain_event in events._subscribers[DomainEvent]


def test_published_event_creates_audit_row_after_commit(actor, django_capture_on_commit_callbacks):
    """Step 1.3 done-when: an event published in a test produces an AuditLog row after commit."""
    with django_capture_on_commit_callbacks(execute=True):
        publish(MemberSuspended(actor_id=actor.pk, target_id=17, reason="repeated absences"))
        assert AuditLog.objects.count() == 0  # nothing before commit

    entry = AuditLog.objects.get()
    assert entry.event_type == "audit_tests.user.suspended"
    assert entry.actor == actor
    assert (entry.target_type, entry.target_id) == ("accounts.User", "17")
    assert entry.metadata == {"reason": "repeated absences"}
    assert entry.before is None
    assert entry.after is None


def test_changes_become_before_and_after():
    events.dispatch(ThingConfigured(changes=(("scale_max", 5, 10), ("label", "", "Excellent"))))
    entry = AuditLog.objects.get()
    assert entry.before == {"scale_max": 5, "label": ""}
    assert entry.after == {"scale_max": 10, "label": "Excellent"}
    assert entry.metadata == {}


def test_rolled_back_event_is_not_audited(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        try:
            with transaction.atomic():
                publish(MemberSuspended(target_id=1, reason="x"))
                raise RuntimeError("rollback")
        except RuntimeError:
            pass
    assert not AuditLog.objects.exists()


def test_events_marked_not_audited_are_skipped():
    events.dispatch(NotWorthAuditing())
    assert not AuditLog.objects.exists()


def test_settings_change_is_audited_end_to_end(actor, django_capture_on_commit_callbacks):
    """BR-08: configuration changes are logged with before/after and request context."""
    ctx = RequestContext(request_id="b" * 32, ip_address="198.51.100.4", user_agent="browser")
    with request_context(ctx), django_capture_on_commit_callbacks(execute=True):
        system_services.update_settings(actor=actor, min_aggregate_group_size=4)

    entry = AuditLog.objects.get(event_type="system.settings.changed")
    assert entry.actor == actor
    assert (entry.target_type, entry.target_id) == ("system.SystemSettings", "1")
    assert entry.before == {"min_aggregate_group_size": 3}
    assert entry.after == {"min_aggregate_group_size": 4}
    assert entry.ip_address == "198.51.100.4"
    assert entry.request_id == "b" * 32
