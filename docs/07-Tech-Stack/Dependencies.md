---
tags: [tech-stack]
---
# Dependencies

> [!important] Rule
> Add a dependency **only in the step that needs it**. Pin the exact version. Log the
> addition in [[Progress Log]]. Check compatibility with Django 5.2 / Python 3.12 / Node LTS.

## Infrastructure images
| Image | Purpose | Added in step | Status |
|---|---|---|---|
| `mysql:8.4` (LTS) | database | 1.1 | ✅ |
| `redis:7.4-alpine` | channel layer / cache | 1.1 | ✅ |

## Backend
| Package | Purpose | Added in step | Status |
|---|---|---|---|
| Django==5.2.18 | framework | 1.2 | ✅ |
| djangorestframework==3.18.3 | REST API | 1.2 | ✅ |
| mysqlclient==2.3.0 | MySQL driver (needs `default-libmysqlclient-dev`, `pkg-config`, `build-essential`) | 1.2 | ✅ verified on MySQL (container); local venv install pending system packages |
| django-environ==0.14.0 | env config | 1.2 | ✅ |
| drf-spectacular==0.30.0 | OpenAPI | 1.2 | ✅ |
| django-filter | API filtering | 2.1 | 📝 |
| argon2-cffi==25.1.0 | Argon2 password hashing (first in `PASSWORD_HASHERS`) | 1.4 | ✅ |
| pytest==9.1.1, pytest-django==4.14.0, factory-boy==3.3.3 | tests (dev) | 1.2 | ✅ |
| ruff==0.17.1 | lint/format (dev) | 1.2 | ✅ |
| pre-commit (4.7.0) | git hooks (dev); hooks: pre-commit-hooks v6.0.0, gitleaks v8.30.0, ruff-pre-commit v0.17.1 | 1.1 | ✅ |
| channels, channels-redis, daphne | WebSockets | 5.1 | 📝 |
| redis (py client) | cache / health check | 5.1 | 📝 |
| openpyxl | Excel export | 4.5 | 📝 |
| reportlab or weasyprint | PDF export (ADR in 4.5) | 4.5 | 📝 |
| Pillow | profile photos (only if enabled) | optional | 📝 |
| django-cors-headers | **not used** unless an ADR requires cross-origin | – | ⛔ |

## Frontend
| Package | Purpose | Added in step | Status |
|---|---|---|---|
| react, react-dom, vite, typescript | runtime/build | 1.5 | 📝 |
| react-router-dom | routing | 1.5 | 📝 |
| @tanstack/react-query | server state | 1.5 | 📝 |
| axios | HTTP | 1.5 | 📝 |
| react-hook-form, zod, @hookform/resolvers | forms | 1.5 | 📝 |
| @mui/material, @emotion/react, @emotion/styled, @mui/icons-material | UI | 1.5 | 📝 |
| vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom, msw | tests | 1.5 | 📝 |
| eslint, prettier (+ TS/React plugins) | quality | 1.5 | 📝 |
| recharts | charts | 3.3 | 📝 |
| @playwright/test | e2e | 6.1 | 📝 |
