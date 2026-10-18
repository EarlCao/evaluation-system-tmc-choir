#!/usr/bin/env bash
# Database backup script (step 6.4: SET-04, NFR-07).
# Creates a compressed, permission-restricted (0600) MySQL dump with SHA-256 checksum,
# optional AES-256 GPG encryption (when BACKUP_PASSPHRASE is set), and retention rotation.
#
# Usage:
#   scripts/backup.sh [output_dir]
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
DB_NAME="${MYSQL_DATABASE:-choir_eval}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

ARCHIVE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

dump_mysql() {
  if [ -n "${MYSQL_HOST:-}" ]; then
    MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysqldump \
      -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -uroot \
      --single-transaction --routines --triggers --events --set-gtid-purged=OFF \
      --default-character-set=utf8mb4 "$DB_NAME"
  else
    docker compose exec -T mysql sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -h 127.0.0.1 -uroot --single-transaction --routines --triggers --events --set-gtid-purged=OFF --default-character-set=utf8mb4 "$MYSQL_DATABASE"'
  fi
}

echo "› Dumping database '${DB_NAME}' to ${ARCHIVE}..."
dump_mysql | gzip -9 > "$ARCHIVE"

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

sha256sum "$ARCHIVE" > "${ARCHIVE}.sha256"
chmod 600 "$ARCHIVE" "${ARCHIVE}.sha256"

# Rotate backups older than RETENTION_DAYS
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${DB_NAME}_*.sql.gz*" \) -mtime +"$RETENTION_DAYS" -delete

echo "✔ Backup complete: $ARCHIVE ($(wc -c < "$ARCHIVE") bytes)"
