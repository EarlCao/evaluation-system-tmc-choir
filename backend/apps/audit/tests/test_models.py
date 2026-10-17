from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.models import AppendOnlyViolation

pytestmark = pytest.mark.django_db


def make(**kwargs) -> AuditLog:
    return AuditLog.objects.create(
        event_type=kwargs.pop("event_type", "test.thing.happened"), **kwargs
    )


def test_entries_can_be_created():
    entry = make()
    assert entry.pk is not None
    assert entry.occurred_at is not None


def test_entries_cannot_be_updated():
    """AUD-03"""
    entry = make()
    entry.event_type = "tampered"
    with pytest.raises(AppendOnlyViolation):
        entry.save()
    with pytest.raises(AppendOnlyViolation):
        AuditLog.objects.filter(pk=entry.pk).update(event_type="tampered")
    entry.refresh_from_db()
    assert entry.event_type == "test.thing.happened"


def test_entries_cannot_be_deleted():
    """AUD-03"""
    entry = make()
    with pytest.raises(AppendOnlyViolation):
        entry.delete()
    with pytest.raises(AppendOnlyViolation):
        AuditLog.objects.all().delete()
    assert AuditLog.objects.count() == 1


def test_actor_cannot_be_deleted_while_referenced(actor):
    from django.db.models import ProtectedError

    make(actor=actor)
    with pytest.raises(ProtectedError):
        actor.delete()


def test_default_ordering_is_newest_first():
    now = timezone.now()
    old = make(occurred_at=now - timedelta(minutes=5))
    new = make(occurred_at=now)
    assert list(AuditLog.objects.all()) == [new, old]
