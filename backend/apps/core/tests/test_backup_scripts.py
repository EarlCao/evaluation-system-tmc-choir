"""SET-04: relocated recovery archives must be verified before any database access."""

import hashlib
import os
import subprocess
from pathlib import Path


def run_restore(tmp_path, archive):
    for command in ("mysql", "docker"):
        stub = tmp_path / command
        stub.write_text("#!/bin/sh\necho DATABASE_ACCESS_REACHED >&2\nexit 97\n")
        stub.chmod(0o755)
    script = Path(__file__).resolve().parents[4] / "scripts" / "restore.sh"
    return subprocess.run(  # noqa: S603 -- repository script and test-owned paths only
        ["/bin/bash", str(script), str(archive), "readiness_recovery"],
        env={**os.environ, "PATH": f"{tmp_path}:{os.environ['PATH']}", "MYSQL_HOST": "127.0.0.1"},
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )


def test_restore_does_not_verify_a_different_file_named_in_the_sidecar(tmp_path):
    original = tmp_path / "original.sql.gz"
    original.write_bytes(b"original backup")
    archive = tmp_path / "relocated.sql.gz"
    archive.write_bytes(b"corrupted relocated backup")
    checksum = hashlib.sha256(original.read_bytes()).hexdigest()
    archive.with_suffix(".gz.sha256").write_text(f"{checksum}  {original}\n")

    result = run_restore(tmp_path, archive)

    assert result.returncode != 0
    assert "FAILED" in result.stdout
    assert "DATABASE_ACCESS_REACHED" not in result.stderr


def test_restore_accepts_a_valid_archive_moved_from_another_host(tmp_path):
    archive = tmp_path / "relocated.sql.gz"
    archive.write_bytes(b"valid relocated backup")
    checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".gz.sha256").write_text(
        f"{checksum}  /old-server/backups/original.sql.gz\n"
    )

    result = run_restore(tmp_path, archive)

    assert f"{archive}: OK" in result.stdout
    assert "DATABASE_ACCESS_REACHED" in result.stderr
