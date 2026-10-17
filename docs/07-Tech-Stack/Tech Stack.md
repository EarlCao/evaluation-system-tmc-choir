---
tags: [tech-stack]
---
# Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language (BE) | **Python 3.12** | system Python on Ubuntu 24.04 (WSL) is 3.12.3 |
| Framework | **Django 5.2 LTS** | supported until April 2028 |
| API | **Django REST Framework** | serializers, permissions, throttling, filtering, pagination |
| API docs | **drf-spectacular** | OpenAPI 3 |
| Database | **MySQL 8.x** via `mysqlclient` | Docker in dev; `utf8mb4` |
| Real-time | **Django Channels** + **channels-redis** | Phase 5 |
| Cache / channel layer | **Redis 7** | Docker in dev |
| ASGI server | **daphne** (dev and prod) | behind Nginx in prod |
| Auth | **Django session auth** + CSRF | same-origin SPA (ADR-003) |
| Config | **django-environ** | `.env` in dev |
| Frontend | **React 19 + Vite 8 + TypeScript 6.0** | Node 24; TS pinned < 6.1 (ADR-015) |
| Routing | **React Router 8** (`react-router`) | `RouterProvider` from `react-router/dom` |
| Server state | **TanStack Query** | |
| Forms | **React Hook Form + Zod** | |
| HTTP | **axios** | single instance in `lib/apiClient.ts` (ADR-006) |
| UI library | **MUI** (`@mui/material`) | ADR-005 |
| Charts | **Recharts** | |
| Tests (BE) | **pytest, pytest-django, factory-boy** | against MySQL |
| Tests (FE) | **Vitest, React Testing Library, user-event, MSW** | |
| E2E | **Playwright** | Phase 6 |
| Lint/format (BE) | **Ruff** (lint + format) | replaces Black (ADR-007) |
| Lint/format (FE) | **ESLint + Prettier** | |
| Hooks | **pre-commit** | ruff, eslint, prettier, secret scan |
| Containers | **Docker + Docker Compose** | mysql, redis in dev; full stack in prod |
| Reverse proxy | **Nginx** + TLS (Let's Encrypt) | Phase 6 |

Related: [[Dependencies]] · [[Dev Environment Setup]] · [[Decisions Log]]
