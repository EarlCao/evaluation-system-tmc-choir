"""Step 6.4: data management tests (SET-03, SET-04, NFR-07, BR-06).

Covers:
1. Data-retention enforcement (``apply_retention`` service + management command) for closed/archived
   evaluations and audit logs.
2. Account self-deactivation (``POST /api/v1/auth/deactivate/``) and preservation of historical
   evaluations (BR-06).
3. Member own-data export (``GET /api/v1/me/export/``) with evaluator-anonymity verification and
   audit logging.
4. Backup and restore scripts (``scripts/backup.sh``, ``scripts/restore.sh``).
"""

from datetime import timedelta
from pathlib import Path

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.constants import UserStatus
from apps.accounts.tests.factories import DEFAULT_PASSWORD
from apps.audit.models import AuditLog
from apps.core.testing.privacy import assert_no_evaluator_leak
from apps.evaluations import services as evaluation_services
from apps.evaluations.models import Evaluation, EvaluationRevision
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory
from apps.system import services as system_services

pytestmark = pytest.mark.django_db

REPO_ROOT = Path(__file__).resolve().parents[4]


def test_apply_retention_keeps_everything_when_retention_is_null(super_admin):
    system_services.update_settings(
        actor=super_admin,
        retention_evaluations_days=None,
        retention_revisions_days=None,
        retention_audit_days=None,
    )
    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    cycle = make_cycle(super_admin, form=form, open=True)
    evaluator = MemberProfileFactory().user
    recipient = MemberProfileFactory().user
    ev = evaluation_services.submit_evaluation(
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": 4}],
        comment="Old evaluation",
    )
    evaluation_services.close_cycle(actor=super_admin, cycle=cycle)
    Evaluation.objects.filter(pk=ev.pk).update(submitted_at=timezone.now() - timedelta(days=900))

    result = evaluation_services.apply_retention()
    assert result == {
        "purged_evaluations": 0,
        "purged_revisions": 0,
        "purged_audit_logs": 0,
    }
    assert Evaluation.objects.filter(pk=ev.pk).exists()


def test_apply_retention_purges_expired_closed_evaluations_and_audit_logs(
    super_admin, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        system_services.update_settings(
            actor=super_admin,
            retention_evaluations_days=30,
            retention_audit_days=60,
        )
    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    closed_cycle = make_cycle(super_admin, form=form, open=True, name="Closed Period")
    evaluator = MemberProfileFactory().user
    recipient = MemberProfileFactory().user
    cv_id = form.items.get().criterion_version_id

    old_eval = evaluation_services.submit_evaluation(
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": cv_id, "value": 4}],
        comment="Expired closed evaluation",
    )
    evaluation_services.close_cycle(actor=super_admin, cycle=closed_cycle)
    Evaluation.objects.filter(pk=old_eval.pk).update(
        submitted_at=timezone.now() - timedelta(days=45)
    )

    make_cycle(super_admin, form=form, open=True, name="Open Period")
    open_eval = evaluation_services.submit_evaluation(
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": cv_id, "value": 5}],
        comment="Still in open cycle",
    )
    Evaluation.objects.filter(pk=open_eval.pk).update(
        submitted_at=timezone.now() - timedelta(days=45)
    )

    old_log = AuditLog.objects.first()
    assert old_log is not None
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE audit_auditlog SET occurred_at = %s WHERE id = %s",
            [timezone.now() - timedelta(days=90), old_log.pk],
        )

    call_command("apply_retention")

    assert not Evaluation.objects.filter(pk=old_eval.pk).exists()
    assert not EvaluationRevision.objects.filter(evaluation_id=old_eval.pk).exists()
    assert Evaluation.objects.filter(pk=open_eval.pk).exists(), (
        "Evaluations in an OPEN cycle must never be purged"
    )
    assert not AuditLog.objects.filter(pk=old_log.pk).exists()
    assert AuditLog.objects.filter(event_type="system.retention.applied").exists()


def test_self_deactivation_preserves_evaluations_and_logs_out(
    super_admin, django_capture_on_commit_callbacks
):
    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    make_cycle(super_admin, form=form, open=True)
    member = MemberProfileFactory().user
    recipient = MemberProfileFactory().user
    ev = evaluation_services.submit_evaluation(
        evaluator=member,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": 4}],
        comment="Preserved after deactivation",
    )

    client = APIClient()
    client.force_login(member)

    wrong = client.post(
        reverse("accounts:deactivate"),
        {"password": "wrong-password", "reason": "Leaving choir"},
        format="json",
    )
    assert wrong.status_code == 400
    assert "password" in wrong.json()["error"]["fields"]

    with django_capture_on_commit_callbacks(execute=True):
        ok = client.post(
            reverse("accounts:deactivate"),
            {"password": DEFAULT_PASSWORD, "reason": "Graduated"},
            format="json",
        )
    assert ok.status_code == 200
    member.refresh_from_db()
    assert member.status == UserStatus.DEACTIVATED
    assert Evaluation.objects.filter(pk=ev.pk).exists()
    assert AuditLog.objects.filter(
        event_type="accounts.user.status_changed",
        actor=member,
        target_id=str(member.pk),
    ).exists()

    # Session is logged out immediately
    assert client.get(reverse("accounts:me")).status_code == 401


def test_last_super_admin_cannot_self_deactivate(super_admin):
    client = APIClient()
    client.force_login(super_admin)
    response = client.post(
        reverse("accounts:deactivate"),
        {"password": DEFAULT_PASSWORD},
        format="json",
    )
    assert response.status_code == 409
    super_admin.refresh_from_db()
    assert super_admin.status == UserStatus.ACTIVE


def test_own_data_export_includes_own_records_and_anonymises_evaluators(super_admin):
    form = make_form(super_admin, criteria=[make_criterion(super_admin, name="Tone")])
    make_cycle(super_admin, form=form, open=True)
    cv_id = form.items.get().criterion_version_id

    member = MemberProfileFactory().user
    evaluator_a = MemberProfileFactory().user
    evaluator_b = MemberProfileFactory().user
    other_target = MemberProfileFactory().user

    evaluation_services.submit_evaluation(
        evaluator=evaluator_a,
        recipient_public_id=member.public_id,
        ratings=[{"criterion_version": cv_id, "value": 4}],
        comment="Warm resonance.",
    )
    evaluation_services.submit_evaluation(
        evaluator=evaluator_b,
        recipient_public_id=member.public_id,
        ratings=[{"criterion_version": cv_id, "value": 5}],
        comment="Clear diction.",
    )
    evaluation_services.submit_evaluation(
        evaluator=member,
        recipient_public_id=other_target.public_id,
        ratings=[{"criterion_version": cv_id, "value": 5}],
        comment="My evaluation of another member.",
    )

    client = APIClient()
    client.force_login(member)
    response = client.get(reverse("reports:my-export"))
    assert response.status_code == 200
    data = response.json()

    assert data["account"]["username"] == member.username
    assert len(data["evaluations_given"]) == 1
    assert data["evaluations_given"][0]["comment"] == "My evaluation of another member."
    assert len(data["feedback_received"]["items"]) == 2
    assert_no_evaluator_leak(data, evaluator_a, evaluator_b)
    assert AuditLog.objects.filter(
        event_type="accounts.data_export.generated",
        actor=member,
        target_id=str(member.pk),
    ).exists()


def test_backup_and_restore_scripts_exist():
    for name in ("backup.sh", "restore.sh"):
        assert (REPO_ROOT / "scripts" / name).stat().st_mode & 0o111
    backup = (REPO_ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    restore = (REPO_ROOT / "scripts" / "restore.sh").read_text(encoding="utf-8")
    assert "mysqldump" in backup
    assert "--single-transaction" in backup
    assert "sha256sum" in backup
    assert "mktemp --suffix=.sql.gz" in backup
    assert "sha256sum -c" in restore
    assert "migrate --check" in restore
    assert '-e RESTORE_CHECK_DATABASE="$TARGET_DB"' in restore
    assert 'os.environ["RESTORE_CHECK_DATABASE"]' in restore
