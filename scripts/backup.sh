#!/usr/bin/env bash
# Database backup script (step 6.4: SET-04, NFR-07).
# Creates a compressed, permission-restricted (0600) MySQL dump with SHA-256 checksum,
# optional AES-256 GPG encryption (when BACKUP_PASSPHRASE is set), and retention rotation.
#
# Usage:
#   scripts/backup.sh [output_dir] [database]
set -euo pipefail
umask 077

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${1:-${BACKUP_DIR:-$REPO_ROOT/backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB_NAME="${2:-${MYSQL_DATABASE:-choir_eval}}"
if [[ ! "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ || ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "ERROR: invalid database name or backup retention days." >&2
  exit 1
fi
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
BACKUP_DIR=$(realpath "$BACKUP_DIR")
if [[ "$BACKUP_DIR" == / || "$BACKUP_DIR" == "$REPO_ROOT" ]]; then
  echo "ERROR: use a dedicated backup subdirectory." >&2
  exit 1
fi
chmod 700 "$BACKUP_DIR"

ARCHIVE="$(mktemp --suffix=.sql.gz "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}_XXXXXXXX")"

dump_mysql() {
  if [ -n "${MYSQL_HOST:-}" ]; then
    MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysqldump \
      -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -uroot \
      --single-transaction --routines --triggers --events --set-gtid-purged=OFF \
      --default-character-set=utf8mb4 "$DB_NAME"
  else
    docker compose -f "${BACKUP_COMPOSE_FILE:-docker-compose.yml}" --env-file .env exec -T mysql sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -h 127.0.0.1 -uroot --single-transaction --routines --triggers --events --set-gtid-purged=OFF --default-character-set=utf8mb4 "$1"' -- "$DB_NAME"
  fi
}

echo "› Dumping database '${DB_NAME}' to ${ARCHIVE}..."
if ! dump_mysql | gzip -9 > "$ARCHIVE"; then
  rm -f "$ARCHIVE"
  echo "ERROR: database backup failed; partial archive removed." >&2
  exit 1
fi

if [ ! -s "$ARCHIVE" ]; then
  echo "ERROR: backup archive is empty: $ARCHIVE" >&2
  rm -f "$ARCHIVE"
  exit 1
fi

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" \
    --symmetric --cipher-algo AES256 -o "${ARCHIVE}.gpg" "$ARCHIVE"
  rm -f "$ARCHIVE"
  ARCHIVE="${ARCHIVE}.gpg"
fi

(cd "$BACKUP_DIR" && sha256sum "$(basename "$ARCHIVE")") > "${ARCHIVE}.sha256"
chmod 600 "$ARCHIVE" "${ARCHIVE}.sha256"

# Rotate backups older than RETENTION_DAYS
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${DB_NAME}_*.sql.gz*" \) -mtime +"$RETENTION_DAYS" -delete

echo "✔ Backup complete: $ARCHIVE ($(wc -c < "$ARCHIVE") bytes)"
