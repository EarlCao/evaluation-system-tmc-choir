import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import User
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db

ADMIN_PASSWORD = "Conductor-Baton-42"  # gitleaks:allow (fake test password)

ARGS = [
    "--email",
    "boss@example.org",
    "--username",
    "boss_q2",
    "--first-name",
    "Boss",
    "--last-name",
    "Q",
]


def test_create_super_admin_from_env_password(monkeypatch, django_capture_on_commit_callbacks):
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", ADMIN_PASSWORD)
    with django_capture_on_commit_callbacks(execute=True):
        call_command("create_super_admin", *ARGS)
    admin = User.objects.get(username="boss_q2")
    assert admin.is_super_admin
    assert admin.check_password(ADMIN_PASSWORD)
    assert AuditLog.objects.filter(
        event_type="accounts.user.super_admin_created", target_id=str(admin.pk)
    ).exists()


def test_weak_password_is_rejected(monkeypatch):
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "short")
    with pytest.raises(CommandError, match="password"):
        call_command("create_super_admin", *ARGS)
    assert not User.objects.filter(username="boss_q2").exists()


def test_requires_password_when_not_interactive(monkeypatch):
    monkeypatch.delenv("SUPER_ADMIN_PASSWORD", raising=False)
    monkeypatch.setattr("sys.stdin.isatty", lambda: False)
    with pytest.raises(CommandError, match="SUPER_ADMIN_PASSWORD"):
        call_command("create_super_admin", *ARGS)
