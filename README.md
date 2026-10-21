# Choir Member Evaluation System

A private, organised and constructive way for choir members to evaluate one another,
share comments and suggestions, and review feedback **without revealing evaluator
identities to ordinary members**. The Super Admin can see identities, and every such access is audit-logged.

- **Architecture:** modular monolith, with Django 5.2 + DRF (ASGI) and a React + Vite + TypeScript SPA
- **Data:** MySQL 8 · Redis 7 (Channels layer / cache)
- **Docs:** Obsidian vault in [`docs/`](docs/00-Home/Home.md) (start at `docs/00-Home/Home.md`)
- **Rules for contributors & AI agents:** [`AGENT.md`](AGENT.md). Read it before writing code.
- **Status:** see [`docs/08-Roadmap/Roadmap.md`](docs/08-Roadmap/Roadmap.md)

## Quick start (Docker, recommended)

You only need **Docker** (with Docker Compose). Everything else runs in containers.

```bash
# 1. Create your .env from the template (once), then replace every "change-me" value
cp .env.example .env
#    generate a secret:  python3 -c "import secrets; print(secrets.token_urlsafe(50))"
#    keep MYSQL_PASSWORD identical to the password inside DATABASE_URL

# 2. Build and start everything: MySQL, Redis, backend, frontend, worker
docker compose up -d --build

# 3. Check that it is running (backend "healthy", frontend "Up")
docker compose ps

# 4. Create the first Super Admin (asks for the password twice)
docker compose exec backend python manage.py create_super_admin \
    --email you@example.org --username admin --first-name Your --last-name Name
```

Then open **http://localhost:5280** and log in.

| What | URL |
|---|---|
| App (React SPA) | http://localhost:5280 |
| API health check | http://localhost:8010/api/v1/health/ |
| API docs (Swagger, dev only) | http://localhost:8010/api/docs/ |

Optional demo data (a published form, an open evaluation period and 6 demo members):

```bash
docker compose exec -e DEMO_MEMBER_PASSWORD='choose-a-long-password' backend \
    python manage.py seed_demo_data --members 6 --open-cycle
```

New members can also register at http://localhost:5280/register. By default a Super Admin
approves them under **Admin → Members**.

### Everyday commands

```bash
docker compose up -d                   # start (no rebuild)
docker compose down                    # stop (database is kept)
docker compose down -v                 # stop AND delete all local data (DB, Redis)
docker compose logs -f backend frontend   # follow logs
docker compose restart backend         # restart one service

docker compose exec backend pytest                      # backend tests (MySQL)
docker compose exec backend ruff check .                # backend lint
docker compose exec backend python manage.py migrate    # apply migrations (also runs on start)
docker compose exec backend python manage.py shell      # Django shell

cd frontend && npm install && npm run test              # frontend tests (on the host)
```

After changing **Python dependencies** run `docker compose up -d --build backend worker`.
After changing **`frontend/package.json`**:

```bash
docker compose rm -sf frontend
docker volume rm choir-eval_frontend_node_modules
docker compose up -d --build frontend
```

### Services and ports

| Service | What it does | Host port |
|---|---|---|
| `frontend` | Vite dev server (hot reload), proxies `/api` and `/ws` to the backend | 5280 |
| `backend` | Django + Channels on Daphne (ASGI: HTTP + WebSockets); runs migrations on start | 8010 |
| `worker` | Sends the delayed "you have new feedback" notifications every 60 s | – |
| `mysql` | MySQL 8.4 | 3307 |
| `redis` | Redis 7.4 (WebSocket channel layer) | 6380 |

All ports are bound to `127.0.0.1` only. Change them in `.env` (`FRONTEND_HOST_PORT`,
`BACKEND_HOST_PORT`, `MYSQL_HOST_PORT`, `REDIS_HOST_PORT`) if they clash with another project.

### Troubleshooting

- **A different website opens (e.g. "SkillServe"):** that is another project on this machine
  (it uses `localhost:5173`; others use `8000`/`8080`). This app is always **http://localhost:5280**.
- **Nothing on 5280 after restarting the computer:** start the stack again with
  `docker compose up -d` (your data is kept in Docker volumes).
- **Port already in use:** stop whatever uses it (e.g. a host `npm run dev` on 5280) or change the port in `.env`.
- **`backend` not healthy:** `docker compose logs backend`. Usually a wrong password in `.env`.
  If you changed `MYSQL_PASSWORD` after the first start, the old one is still in the volume:
  `docker compose down -v` (deletes local data) and start again.
- **Page doesn't update after an edit:** `docker compose restart frontend`.

## Running without Docker for the app (optional)

Run only MySQL and Redis in Docker and the backend/frontend on your machine.

Prerequisites: Python 3.12 with `python3-venv`, Node.js 24 LTS, and the MySQL client headers:
`sudo apt-get install -y python3-dev default-libmysqlclient-dev pkg-config build-essential`.

```bash
cp .env.example .env                   # once, then edit it
docker compose up -d mysql redis

# backend (terminal 1)
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements/dev.txt
cd backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py create_super_admin --email you@example.org --username admin --first-name Your --last-name Name
.venv/bin/python manage.py runserver 8010                    # ASGI via Daphne
.venv/bin/python manage.py deliver_notifications --loop 60   # optional, terminal 3

# frontend (terminal 2)
cd frontend && npm install && npm run dev                     # http://localhost:5280
```

## Git hooks (contributors)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements/dev.txt
backend/.venv/bin/pre-commit install
backend/.venv/bin/pre-commit run --all-files   # lint/format/secret-scan everything
```

## Repository layout

```
AGENT.md                 project rules (architecture, privacy, security, conventions)
docker-compose.yml       dev stack: mysql, redis, backend, frontend, worker
docker/mysql/            MySQL config (utf8mb4, strict, UTC) + dev init scripts
backend/                 Django project (apps/<module>/ per module), Dockerfile.dev
frontend/                React SPA (src/features/<feature>/ per feature), Dockerfile.dev
docs/                    Obsidian documentation vault
```

> **Note:** `docker/mysql/init/` scripts run only when the MySQL volume is first created.
> After changing them, recreate the volume with `docker compose down -v`.

## Deployment readiness

Read the [pre-deployment review](docs/10-Testing/Deployment%20Readiness%202026-10-20.md)
for verified fixes, the production procedure, and the remaining live-hosting launch gates.
The quick start above is a development stack. Production uses `deploy/docker-compose.prod.yml`.

## Security

Never commit `.env`, credentials, tokens or database dumps. `.gitignore` excludes them,
and the pre-commit `gitleaks` hook blocks staged secrets.
