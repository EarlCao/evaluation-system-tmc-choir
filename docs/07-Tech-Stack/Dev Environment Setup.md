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
- MySQL config `docker/mysql/conf.d/choir.cnf`: utf8mb4 / utf8mb4_unicode_ci, strict
  `sql_mode`, UTC. Time zone tables are loaded by the image (needed for Django date truncation).
- `docker/mysql/init/01-test-db-grants.sh` grants the app user rights on `test_choir_eval`
  so pytest-django can create and drop its test DB. It runs only on first volume
  creation; re-run it with `docker compose down -v`.

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
python manage.py runserver 8000

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxies /api, /ws → :8000)
```

## Environment variables (`.env.example`)
| Key | Example | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | |
| `DJANGO_SECRET_KEY` | *(generate)* | never commit |
| `FEEDBACK_ID_KEY` | *(generate)* | HMAC key for opaque feedback IDs |
| `DJANGO_DEBUG` | `True` | `False` in prod |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:5173` | |
| `DATABASE_URL` | `mysql://choir:<MYSQL_PASSWORD>@127.0.0.1:3307/choir_eval` | password must match `MYSQL_PASSWORD` |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | | used by docker-compose |
| `MYSQL_HOST_PORT` | `3307` | host port for MySQL |
| `REDIS_HOST_PORT` | `6380` | host port for Redis |
| `REDIS_URL` | `redis://127.0.0.1:6380/0` | |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | SMTP in prod |
| `DEFAULT_FROM_EMAIL` | `no-reply@example.org` | |
| `FRONTEND_URL` | `http://localhost:5173` | for password-reset links |

Related: [[Tech Stack]] · [[Roadmap]]
