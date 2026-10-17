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
| django-filter==26.2 | API filtering (`DirectoryFilter`) | 2.1 | ✅ |
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
| react / react-dom 19.3.1 | runtime | 1.5 | ✅ |
| react-router 8.4.0 | routing | 1.5 | ✅ |
| @tanstack/react-query 5.104.3 | server state | 1.5 | ✅ |
| axios 1.20.0 | HTTP | 1.5 | ✅ |
| @mui/material 9.5.0, @emotion/react 11.14.0, @emotion/styled 11.14.1 | UI | 1.5 | ✅ |
| vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3, @types/react(-dom) 19.3.0, @types/node 24 | build/types | 1.5 | ✅ |
| vitest 5.0.5, jsdom 30.1.3, @testing-library/react 16.3.3, /dom 10.4.2, /user-event 14.6.8, /jest-dom 7.0.1, msw 3.0.3 | tests | 1.5 | ✅ |
| eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.71.2, eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.7, globals 17.13.0, prettier 3.9.10, eslint-config-prettier 10.1.8 | quality | 1.5 | ✅ |
| react-hook-form 7.90.0, zod 4.6.7, @hookform/resolvers 5.9.2 | forms | 1.6 | ✅ |
| @mui/icons-material | icons | when first needed | 📝 |
| recharts 3.10.1 + react-is 19.3.1 (peer) | trend chart (lazy-loaded) | 3.3 | ✅ |
| @playwright/test | e2e | 6.1 | 📝 |

All frontend versions are pinned exactly (`--save-exact`) and locked in `frontend/package-lock.json`.
