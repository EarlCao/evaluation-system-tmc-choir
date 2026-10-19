import io
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.system import backup

pytestmark = pytest.mark.django_db


def test_backup_create_list_download_delete(
    super_admin, admin_client_api, tmp_path, monkeypatch, django_capture_on_commit_callbacks
):
    monkeypatch.setattr(backup, "get_backup_dir", lambda: tmp_path)

    # 1. Create backup
    response = admin_client_api.post(
        reverse("system-admin:backup-list"),
        {"note": "Manual system backup"},
        format="json",
    )
    assert response.status_code == 201
    data = response.json()
    filename = data["filename"]
    assert filename.endswith(".json.gz")
    assert data["note"] == "Manual system backup"
    assert data["created_by"] == super_admin.username
    assert (tmp_path / filename).exists()
    assert (tmp_path / f"{filename}.sha256").exists()
    assert (tmp_path / f"{filename}.meta.json").exists()
    assert AuditLog.objects.filter(
        event_type="system.backup.created", target_id=filename
    ).exists()

    # 2. List backups
    list_resp = admin_client_api.get(reverse("system-admin:backup-list"))
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["filename"] == filename

    # 3. Download backup
    dl_resp = admin_client_api.get(
        reverse("system-admin:backup-download", kwargs={"filename": filename})
    )
    assert dl_resp.status_code == 200
    assert dl_resp["Content-Type"] == "application/gzip"
    assert filename in dl_resp["Content-Disposition"]

    # 4. Restore from filename
    restore_resp = admin_client_api.post(
        reverse("system-admin:backup-restore"),
        {"filename": filename},
        format="json",
    )
    assert restore_resp.status_code == 200
    assert restore_resp.json()["status"] == "success"
    assert AuditLog.objects.filter(
        event_type="system.database.restored", target_id=filename
    ).exists()

    # 5. Restore from uploaded file
    file_bytes = (tmp_path / filename).read_bytes()
    upload = SimpleUploadedFile(filename, file_bytes, content_type="application/gzip")
    upload_resp = admin_client_api.post(
        reverse("system-admin:backup-restore"),
        {"file": upload},
        format="multipart",
    )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["status"] == "success"

    # 6. Delete backup
    del_resp = admin_client_api.delete(
        reverse("system-admin:backup-delete", kwargs={"filename": filename})
    )
    assert del_resp.status_code == 204
    assert not (tmp_path / filename).exists()
    assert AuditLog.objects.filter(
        event_type="system.backup.deleted", target_id=filename
    ).exists()


def test_backup_restore_invalid_inputs(admin_client_api, tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "get_backup_dir", lambda: tmp_path)

    # Empty payload
    resp = admin_client_api.post(
        reverse("system-admin:backup-restore"),
        {},
        format="json",
    )
    assert resp.status_code == 400

    # Non-existent filename
    resp2 = admin_client_api.post(
        reverse("system-admin:backup-restore"),
        {"filename": "non_existent.json.gz"},
        format="json",
    )
    assert resp2.status_code == 400

    # Corrupt uploaded file
    corrupt = SimpleUploadedFile("bad.json.gz", b"corrupted data", content_type="application/gzip")
    resp3 = admin_client_api.post(
        reverse("system-admin:backup-restore"),
        {"file": corrupt},
        format="multipart",
    )
    assert resp3.status_code == 400


def test_retention_cleanup_api(admin_client_api):
    resp = admin_client_api.post(reverse("system-admin:data-cleanup"))
    assert resp.status_code == 200
    data = resp.json()
    assert "purged_evaluations" in data
    assert "purged_revisions" in data
    assert "purged_audit_logs" in data


def test_member_forbidden_from_backup_endpoints(member_client):
    # Authenticated as regular member
    assert member_client.get(reverse("system-admin:backup-list")).status_code == 403
    assert member_client.post(reverse("system-admin:backup-list")).status_code == 403
    assert member_client.post(reverse("system-admin:backup-restore")).status_code == 403
    assert member_client.post(reverse("system-admin:data-cleanup")).status_code == 403

