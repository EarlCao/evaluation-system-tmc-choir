---
tags: [tech-stack, setup]
---
# Dev Environment Setup

## Host (verified 2026-10-17)
- Windows + **WSL2 Ubuntu 24.04**. Project at `/home/earlcao/evaluation-system`
  (Windows path: `\\wsl.localhost\Ubuntu-24.04\home\earlcao\evaluation-system`)
- Python 3.12.3 · Node 24.20.0 / npm 11.19.0 · Docker 29.8.1 · git 2.43.0
- MySQL and Redis are **not** installed natively. They run in Docker Compose
  (project name `choir-eval`), bound to localhost only:
  - MySQL 8.4 → `127.0.0.1:3307` (container `choir-eval-mysql-1`)
  - Redis 7.4 → `127.0.0.1:6380` (container `choir-eval-redis-1`)
  - Non-default host ports avoid clashes with the other Docker projects on this machine.
    Override them with `MYSQL_HOST_PORT` / `REDIS_HOST_PORT` in `.env`.
- **Dev ports in use by other local projects** (checked 2026-10-17): 8000 (PHP), 5173 and 5180
  (other Vite apps). This project uses **Django 8010** and **Vite 5280**.
- MySQL config `docker/mysql/conf.d/choir.cnf`: utf8mb4 / utf8mb4_unicode_ci, strict
  `sql_mode`, UTC. Time zone tables are loaded by the image (needed for Django date truncation).
- `docker/mysql/init/01-test-db-grants.sh` grants the app user rights on `test_choir_eval`
  so pytest-django can create and drop its test DB. It runs only on first volume
  creation; re-run it with `docker compose down -v`.

## Run everything in Docker (recommended, ADR-019, added 2026-10-18)
```bash
cp .env.example .env                    # once; replace every change-me
docker compose up -d --build            # mysql, redis, backend, frontend
# SPA: http://localhost:5280   API: http://localhost:8010/api/v1/health/
docker compose exec backend python manage.py create_super_admin \
    --email you@example.org --username you --first-name You --last-name Admin   # SUPER_ADMIN_PASSWORD env or prompt
docker compose exec backend pytest      # 455 tests on MySQL
docker compose logs -f backend frontend
docker compose down                     # keep data;  down -v also deletes the DB volume
```
- **backend** (`backend/Dockerfile.dev`): Python 3.12 + `requirements/dev.txt`, runs `migrate` then `runserver 0.0.0.0:8010`,
  which is **Daphne/ASGI** (HTTP + WebSockets) because `daphne` is first in `INSTALLED_APPS`. The repo is bind-mounted at
  `/app`, so code changes reload and `config/settings/base.py` still reads `/app/.env`; compose overrides `DATABASE_URL` and
  `REDIS_URL` to the `mysql` / `redis` service names. Runs as uid 1000 (`UID`/`GID` build args) so files it writes stay
  editable on the host. Healthcheck: `GET /api/v1/health/`.
- **frontend** (`frontend/Dockerfile.dev`): Node 24, `npm ci` at build time as the `node` user; `./frontend` bind-mounted,
  `node_modules` in a named volume (`frontend_node_modules`) so Linux builds never mix with the host's. Vite proxies `/api`
  and `/ws` to `http://backend:8010` (`VITE_BACKEND_URL`); `VITE_USE_POLLING=true` because WSL/Windows bind mounts can miss
  file events. After changing `package.json`: `docker compose build frontend && docker volume rm choir-eval_frontend_node_modules`
  (with the frontend container removed), then `up -d frontend`.
- Host ports: `BACKEND_HOST_PORT` (8010), `FRONTEND_HOST_PORT` (5280), bound to 127.0.0.1 only. Stop any host-run
  `runserver`/`npm run dev` on those ports first.
- The host still runs `pre-commit` (git hooks) from `backend/.venv`; the frontend hooks use the host's `node_modules`.

## Opening this vault in Obsidian
Obsidian (Windows) → *Open folder as vault* →
`\\wsl.localhost\Ubuntu-24.04\home\earlcao\evaluation-system\docs`

## One-time system packages (needed for `mysqlclient`, step 1.2)
```bash
sudo apt-get update
sudo apt-get install -y python3.12-venv python3-dev default-libmysqlclient-dev pkg-config build-essential
```

## Python tooling & git hooks (done in step 1.1)
`backend/.venv` is the project's single Python venv. It currently holds `pre-commit` only
(`backend/requirements/dev.txt`).
```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements/dev.txt
backend/.venv/bin/pre-commit install          # installs .git/hooks/pre-commit
backend/.venv/bin/pre-commit run --all-files
```
Hooks: whitespace/EOF/line endings, yaml/json/toml checks, merge-conflict and case checks,
large files (>1 MB), private keys, **gitleaks** secret scan, ruff check + format (backend/).

## Planned daily workflow (becomes real during Phase 1)
```bash
# 1. infrastructure
cp .env.example .env              # once; replace every change-me
docker compose up -d mysql redis

# 2. backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py create_super_admin
python manage.py runserver 8010         # project dev port (8000 is used by another local project)

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5280 (proxies /api, /ws → :8010)
# other ports: FRONTEND_PORT=5300 VITE_BACKEND_URL=http://127.0.0.1:8011 npm run dev
```

## Environment variables (`.env.example`)
| Key | Example | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | |
| `DJANGO_SECRET_KEY` | *(generate)* | never commit |
| `FEEDBACK_ID_KEY` | *(generate)* | HMAC key for opaque feedback IDs |
| `DJANGO_DEBUG` | `True` | `False` in prod |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:5280` | |
| `DATABASE_URL` | `mysql://choir:<MYSQL_PASSWORD>@127.0.0.1:3307/choir_eval` | password must match `MYSQL_PASSWORD` |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | | used by docker-compose |
| `MYSQL_HOST_PORT` | `3307` | host port for MySQL |
| `REDIS_HOST_PORT` | `6380` | host port for Redis |
| `REDIS_URL` | `redis://127.0.0.1:6380/0` | |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | SMTP in prod |
| `DEFAULT_FROM_EMAIL` | `no-reply@example.org` | |
| `FRONTEND_URL` | `http://localhost:5280` | for password-reset and verification links |

Related: [[Tech Stack]] · [[Roadmap]]
