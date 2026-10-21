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
ARCHIVE=$(realpath "$ARCHIVE")

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

TARGET_DB="${2:-${MYSQL_DATABASE:-choir_eval}}"
if [[ ! "$TARGET_DB" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: database names must contain only letters, numbers and underscores." >&2
  exit 1
fi

if [ -f "${ARCHIVE}.sha256" ]; then
  echo "› Verifying SHA-256 checksum..."
  if ! read -r EXPECTED_DIGEST _ < "${ARCHIVE}.sha256" || [[ ! "$EXPECTED_DIGEST" =~ ^[[:xdigit:]]{64}$ ]]; then
    echo "ERROR: invalid checksum file." >&2
    exit 1
  fi
  # Bind verification to the supplied archive, not the sidecar's old host/path.
  printf '%s  %s\n' "$EXPECTED_DIGEST" "$ARCHIVE" | sha256sum -c -
else
  echo "ERROR: required checksum file is missing." >&2
  exit 1
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
    docker compose -f "${BACKUP_COMPOSE_FILE:-docker-compose.yml}" --env-file .env exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$@"' -- "$@"
  fi
}

if [ "$(run_mysql -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${TARGET_DB}';")" = "1" ]; then
  echo "› Taking a safety snapshot of '${TARGET_DB}' before restoring..."
  scripts/backup.sh "$(dirname "$ARCHIVE")/pre-restore" "$TARGET_DB"
fi

echo "› Preparing database '${TARGET_DB}'..."
run_mysql -e "CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "› Restoring '${ARCHIVE}' into '${TARGET_DB}'..."
stream_sql | run_mysql "$TARGET_DB"

USERS_COUNT="$(run_mysql -N -B "$TARGET_DB" -e "SELECT COUNT(*) FROM accounts_user;")"
CYCLES_COUNT="$(run_mysql -N -B "$TARGET_DB" -e "SELECT COUNT(*) FROM evaluations_evaluationcycle;")"
echo "✔ Restore complete into '${TARGET_DB}' (users=${USERS_COUNT}, cycles=${CYCLES_COUNT})."

# Check the selected target with Django, not the developer's default database.
if [ -z "${MYSQL_HOST:-}" ]; then
  docker compose -f "${BACKUP_COMPOSE_FILE:-docker-compose.yml}" --env-file .env exec -T \
    -e RESTORE_CHECK_DATABASE="$TARGET_DB" backend \
    python manage.py shell -c \
    'import os; from django.conf import settings; from django.core.management import call_command; settings.DATABASES["default"]["NAME"] = os.environ["RESTORE_CHECK_DATABASE"]; call_command("migrate", "--check")'
else
  echo "Run manage.py migrate --check with DATABASE_URL pointing to the restored database."
fi
