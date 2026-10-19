"""Database backup and restore services for Super Admin (SET-04, NFR-07)."""

import gzip
import hashlib
import io
import json
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.utils import timezone

from apps.audit import services as audit_services
from apps.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-\.]+\.json\.gz$")


def get_backup_dir() -> Path:
    backup_dir = getattr(settings, "BACKUP_DIR", None)
    if not backup_dir:
        backup_dir = settings.REPO_ROOT / "backups"
    path = Path(backup_dir)
    path.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path, 0o700)
    except OSError:
        pass
    return path


def validate_filename(filename: str) -> str:
    if not filename or not SAFE_FILENAME_RE.match(filename) or ".." in filename or "/" in filename or "\\" in filename:
        raise ValidationError(fields={"filename": ["Invalid backup filename."]})
    return filename


def get_backup_file_path(filename: str) -> Path:
    name = validate_filename(filename)
    path = get_backup_dir() / name
    if not path.is_file():
        raise ValidationError(fields={"filename": ["Backup file does not exist."]})
    return path


def create_backup(*, actor=None, note: str = "") -> dict[str, Any]:
    """Generate a gzipped JSON fixture backup of the entire database, compute checksum,
    write metadata, and record an audit log."""
    backup_dir = get_backup_dir()
    timestamp_str = timezone.now().strftime("%Y%m%dT%H%M%SZ")
    filename = f"choir_eval_backup_{timestamp_str}.json.gz"
    file_path = backup_dir / filename

    out = io.StringIO()
    call_command(
        "dumpdata",
        "--natural-foreign",
        "--natural-primary",
        "--exclude", "sessions",
        "--exclude", "contenttypes",
        "--exclude", "auth.Permission",
        stdout=out,
    )
    raw_bytes = out.getvalue().encode("utf-8")
    compressed = gzip.compress(raw_bytes, compresslevel=9)
    sha256 = hashlib.sha256(compressed).hexdigest()

    file_path.write_bytes(compressed)
    try:
        os.chmod(file_path, 0o600)
    except OSError:
        pass

    # Write .sha256
    sha_path = backup_dir / f"{filename}.sha256"
    sha_path.write_text(f"{sha256}  {filename}\n", encoding="utf-8")

    # Write .meta.json
    now_iso = timezone.now().isoformat()
    actor_username = getattr(actor, "username", "system")
    metadata = {
        "filename": filename,
        "created_at": now_iso,
        "created_by": actor_username,
        "size_bytes": len(compressed),
        "sha256": sha256,
        "note": note.strip() if note else "",
    }
    meta_path = backup_dir / f"{filename}.meta.json"
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    audit_services.record(
        event_type="system.backup.created",
        actor=actor,
        target_type="system.Backup",
        target_id=filename,
        metadata={
            "filename": filename,
            "size_bytes": len(compressed),
            "sha256": sha256,
            "note": note,
        },
    )

    return metadata


def list_backups() -> list[dict[str, Any]]:
    """Return all backups in the backup directory, newest first."""
    backup_dir = get_backup_dir()
    results = []

    for item in backup_dir.glob("*.json.gz"):
        filename = item.name
        meta_file = backup_dir / f"{filename}.meta.json"
        if meta_file.is_file():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                results.append(meta)
                continue
            except Exception:
                pass

        # Fallback if no meta file
        stat = item.stat()
        created_at = timezone.datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        results.append({
            "filename": filename,
            "created_at": created_at,
            "created_by": "unknown",
            "size_bytes": stat.st_size,
            "sha256": "",
            "note": "",
        })

    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results


def delete_backup(filename: str, *, actor=None) -> None:
    """Delete a backup file and its checksum and metadata."""
    path = get_backup_file_path(filename)
    backup_dir = get_backup_dir()
    meta_path = backup_dir / f"{filename}.meta.json"
    sha_path = backup_dir / f"{filename}.sha256"

    if path.is_file():
        path.unlink(missing_ok=True)
    if meta_path.is_file():
        meta_path.unlink(missing_ok=True)
    if sha_path.is_file():
        sha_path.unlink(missing_ok=True)

    audit_services.record(
        event_type="system.backup.deleted",
        actor=actor,
        target_type="system.Backup",
        target_id=filename,
        metadata={"filename": filename},
    )


def restore_backup(*, filename: str | None = None, file_content: bytes | None = None, actor=None) -> dict[str, Any]:
    """Restore database from an existing backup file or uploaded content."""
    if not filename and file_content is None:
        raise ValidationError(fields={"backup": ["Provide a backup filename or file content."]})

    if filename:
        path = get_backup_file_path(filename)
        data = path.read_bytes()
        source_name = filename
    else:
        data = file_content or b""
        source_name = "uploaded_file"

    if not data:
        raise ValidationError(fields={"backup": ["Backup content is empty."]})

    # Check if gzipped
    if data[:2] == b"\x1f\x8b":
        try:
            decompressed = gzip.decompress(data)
        except Exception as exc:
            raise ValidationError(fields={"backup": ["Corrupted gzip archive."]}) from exc
    else:
        decompressed = data

    sha256 = hashlib.sha256(data).hexdigest()

    # Validate that it's valid JSON list of fixture objects
    try:
        parsed = json.loads(decompressed.decode("utf-8"))
        if not isinstance(parsed, list):
            raise ValidationError(fields={"backup": ["Invalid backup format: expected fixture array."]})
    except Exception as exc:
        if isinstance(exc, ValidationError):
            raise
        raise ValidationError(fields={"backup": ["Invalid JSON data in backup archive."]}) from exc

    # Write to a secure temporary file to invoke loaddata
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as tf:
        tf.write(decompressed.decode("utf-8"))
        tmp_name = tf.name

    try:
        call_command("loaddata", tmp_name)
    except Exception as exc:
        logger.exception("Failed to restore backup")
        raise ValidationError(fields={"backup": [f"Restore failed: {str(exc)}"]}) from exc
    finally:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)

    audit_services.record(
        event_type="system.database.restored",
        actor=actor,
        target_type="system.Backup",
        target_id=source_name,
        metadata={"source": source_name, "sha256": sha256},
    )

    return {
        "status": "success",
        "message": f"Successfully restored database from {source_name}.",
        "records_count": len(parsed),
        "sha256": sha256,
    }
