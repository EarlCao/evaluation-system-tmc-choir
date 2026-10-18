"""Step 6.0: periods close automatically after their end date."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.evaluations import services
from apps.evaluations.constants import CycleStatus
from apps.evaluations.models import EvaluationCycle
from apps.evaluations.tests.factories import make_cycle

pytestmark = pytest.mark.django_db


def test_only_expired_open_cycles_close(super_admin, django_capture_on_commit_callbacks):
    cycle = make_cycle(super_admin, open=True, name="Spring")
    assert services.close_expired_cycles() == []  # still running
    later = cycle.ends_at + timedelta(seconds=1)
    with django_capture_on_commit_callbacks(execute=True):
        closed = services.close_expired_cycles(now=later)
    assert [c.name for c in closed] == ["Spring"]
    cycle.refresh_from_db()
    assert cycle.status == CycleStatus.CLOSED
    log = AuditLog.objects.get(event_type="evaluations.cycle.closed")
    assert log.actor is None  # closed by the system, not a person
    assert services.close_expired_cycles(now=later) == []  # idempotent


def test_command(super_admin, capsys):
    cycle = make_cycle(super_admin, open=True, name="Old")
    # The period ran out while open (an open cycle's dates can't be moved into the past via
    # the service, so the test sets it directly).
    EvaluationCycle.objects.filter(pk=cycle.pk).update(
        ends_at=timezone.now() - timedelta(minutes=1)
    )
    call_command("close_expired_cycles")
    assert "Closed 1 expired period(s): Old." in capsys.readouterr().out
