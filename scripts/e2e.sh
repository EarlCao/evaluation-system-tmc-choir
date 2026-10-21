#!/usr/bin/env bash
# End-to-end tests (step 6.1) against a THROWAWAY stack: its own compose project, ports and
# database, removed afterwards (set KEEP=1 to keep it for debugging). Your dev data is untouched.
#
#   scripts/e2e.sh                 # all specs
#   scripts/e2e.sh 02-evaluation   # specs matching a pattern (any `playwright test` arguments)
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=choir-eval-e2e
export E2E_MAIL_DIR
E2E_MAIL_DIR=$(mktemp -d /tmp/choir-eval-mail.XXXXXXXX)
chmod 777 "$E2E_MAIL_DIR"  # isolated dev backend writes as root; browser runner reads only
PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.57.0-noble   # keep in step with @playwright/test
export FRONTEND_HOST_PORT=5281 BACKEND_HOST_PORT=8011 MYSQL_HOST_PORT=3308 REDIS_HOST_PORT=6381
# Throwaway credentials for the throwaway database (never used anywhere else).
export E2E_ADMIN_PASSWORD="E2e-Super-Admin-Passphrase-1"   # gitleaks:allow
export E2E_MEMBER_PASSWORD="E2e-Demo-Member-Passphrase-1"  # gitleaks:allow

compose() { docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.e2e.yml "$@"; }
cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    echo "KEEP=1: stack left running on http://localhost:${FRONTEND_HOST_PORT}"
  else
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    case "$E2E_MAIL_DIR" in
      /tmp/choir-eval-mail.*)
        find "$E2E_MAIL_DIR" -maxdepth 1 -type f -delete
        rmdir "$E2E_MAIL_DIR"
        ;;
    esac
  fi
}
trap cleanup EXIT

echo "› starting the e2e stack (project ${PROJECT})"
compose down -v --remove-orphans >/dev/null 2>&1 || true
if [ "${E2E_SKIP_BUILD:-0}" = "1" ]; then
  compose up -d mysql redis backend frontend
else
  compose up -d --build mysql redis backend frontend
fi

echo "› waiting for the production build to be served on :${FRONTEND_HOST_PORT}"
for _ in $(seq 1 120); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${FRONTEND_HOST_PORT}/api/v1/health/"; then break; fi
  sleep 2
done
curl -fsS -o /dev/null "http://127.0.0.1:${FRONTEND_HOST_PORT}/api/v1/health/"

echo "› seeding"
compose exec -T -e SUPER_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" backend python manage.py \
  create_super_admin --email e2e-admin@example.org --username e2eadmin --first-name Erin --last-name Admin
compose exec -T -e DEMO_MEMBER_PASSWORD="$E2E_MEMBER_PASSWORD" backend python manage.py \
  seed_demo_data --members 4 --open-cycle

echo "› running Playwright"
docker run --rm --network host --ipc host \
  -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -e E2E_BASE_URL="http://localhost:${FRONTEND_HOST_PORT}" \
  -e E2E_ADMIN_PASSWORD -e E2E_MEMBER_PASSWORD \
  -e E2E_ALLOW_AUDIT_DELETION=1 \
  -e E2E_MAIL_DIR=/e2e-mail -v "$E2E_MAIL_DIR:/e2e-mail:ro" \
  -v "$PWD/frontend:/work" -w /work \
  "$PLAYWRIGHT_IMAGE" npx playwright test "$@"
