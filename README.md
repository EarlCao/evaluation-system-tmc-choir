# Choir Member Evaluation System

A private, organised and constructive way for choir members to evaluate one another,
share comments and suggestions, and review feedback **without revealing evaluator
identities to ordinary members**. The Super Admin can see identities, and every such access is audit-logged.

- **Architecture:** modular monolith, with Django 5.2 + DRF (ASGI) and a React + Vite + TypeScript SPA
- **Data:** MySQL 8 · Redis 7 (Channels layer / cache)
- **Docs:** Obsidian vault in [`docs/`](docs/00-Home/Home.md) (start at `docs/00-Home/Home.md`)
- **Rules for contributors & AI agents:** [`AGENT.md`](AGENT.md). Read it before writing code.
- **Status:** see [`docs/08-Roadmap/Roadmap.md`](docs/08-Roadmap/Roadmap.md)

## Repository layout

```
AGENT.md                 project rules (architecture, privacy, security, conventions)
docker-compose.yml       local MySQL + Redis
docker/mysql/            MySQL config (utf8mb4, strict, UTC) + dev init scripts
backend/                 Django project (apps/<module>/ per module)
frontend/                React SPA (src/features/<feature>/ per feature)
docs/                    Obsidian documentation vault
```

## Prerequisites

- Docker + Docker Compose
- Python 3.12 (with `python3-venv`)
- Node.js 24 LTS / npm
- For `mysqlclient` (from step 1.2):
  `sudo apt-get install -y python3-dev default-libmysqlclient-dev pkg-config build-essential`

## Getting started

```bash
# 1. Environment: copy the template and replace every "change-me" value
cp .env.example .env
#    generate secrets with: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
#    keep MYSQL_PASSWORD and the password inside DATABASE_URL identical

# 2. Infrastructure (MySQL on 127.0.0.1:3307, Redis on 127.0.0.1:6380 by default)
docker compose up -d mysql redis
docker compose ps            # both should show "(healthy)"

# 3. Python tooling + git hooks
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements/dev.txt
backend/.venv/bin/pre-commit install
```

```bash
# 4. Backend (needs `sudo apt-get install -y default-libmysqlclient-dev pkg-config` once)
cd backend && .venv/bin/pip install -r requirements/dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 8010

# 5. Frontend (new terminal)
cd frontend && npm install
npm run dev                  # http://localhost:5280 (proxies /api and /ws to :8010)
```

Dev ports avoid clashes with other local projects: Django **8010**, Vite **5280**,
MySQL **3307**, Redis **6380**.

## Useful commands

```bash
docker compose up -d mysql redis       # start infrastructure
docker compose down                    # stop (data kept in volumes)
docker compose down -v                 # stop AND delete local DB/Redis data
docker compose logs -f mysql           # follow MySQL logs
backend/.venv/bin/pre-commit run --all-files   # lint/format/secret-scan everything
```

> **Note:** `docker/mysql/init/` scripts run only when the MySQL volume is first created.
> After changing them, recreate the volume with `docker compose down -v`.

## Security

Never commit `.env`, credentials, tokens or database dumps. `.gitignore` excludes them,
and the pre-commit `gitleaks` hook blocks staged secrets.
