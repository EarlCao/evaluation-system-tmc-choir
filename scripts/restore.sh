#!/usr/bin/env bash
# Database restore script (step 6.4: SET-04, NFR-07).
# Verifies the backup checksum, restores a compressed (.sql.gz) or encrypted (.sql.gz.gpg)
# dump into the target MySQL database, and verifies table/row integrity.
#
# Usage:
#   scripts/restore.sh <path/to/backup.sql.gz> [target_database]
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup.sql.gz[.gpg]> [target_database]" >&2
  exit 1
fi

ARCHIVE="$1"
if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: backup file not found: $ARCHIVE" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

TARGET_DB="${2:-${MYSQL_DATABASE:-choir_eval}}"

if [ -f "${ARCHIVE}.sha256" ]; then
  echo "› Verifying SHA-256 checksum..."
  sha256sum -c "${ARCHIVE}.sha256"
fi

stream_sql() {
  case "$ARCHIVE" in
    *.gpg)
      : "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE to decrypt .gpg backup}"
      gpg --batch --yes --decrypt --passphrase "$BACKUP_PASSPHRASE" "$ARCHIVE" | gunzip -c
      ;;
    *.gz)
      gunzip -c "$ARCHIVE"
      ;;
    *)
      cat "$ARCHIVE"
      ;;
  esac
}

run_mysql() {
  if [ -n "${MYSQL_HOST:-}" ]; then
    MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -uroot "$@"
  else
    docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$@"' -- "$@"
  fi
}

echo "› Preparing database '${TARGET_DB}'..."
run_mysql -e "CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "› Restoring '${ARCHIVE}' into '${TARGET_DB}'..."
stream_sql | run_mysql "$TARGET_DB"

USERS_COUNT="$(run_mysql -N -B "$TARGET_DB" -e "SELECT COUNT(*) FROM accounts_user;")"
CYCLES_COUNT="$(run_mysql -N -B "$TARGET_DB" -e "SELECT COUNT(*) FROM evaluations_evaluationcycle;")"
echo "✔ Restore complete into '${TARGET_DB}' (users=${USERS_COUNT}, cycles=${CYCLES_COUNT})."
