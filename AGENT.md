# AGENT.md — Choir Member Evaluation System

Rules for every AI agent and every human contributor working in this repository.
**Read this file completely before writing any code.** If a rule here conflicts with
a request, stop and ask the user. Do not silently break a rule.

---

## 0. Read-before-you-develop checklist

Before starting **any** task:

1. Read this file (`AGENT.md`).
2. Open the documentation vault at `docs/` (an Obsidian vault). Start with
   `docs/00-Home/Home.md`.
3. Open `docs/08-Roadmap/Roadmap.md` and find the **current step**: the first
   unchecked step.
4. Read the module note(s) in `docs/04-Modules/` for the module you will touch.
5. Read `docs/03-Architecture/Privacy Model.md` if the task touches evaluations,
   feedback, notifications, reports, exports or logs.
6. Check `docs/09-Decisions/Decisions Log.md` for decisions that affect the task.

---

## 1. Work phase by phase, step by step (mandatory)

- Development follows `docs/08-Roadmap/Roadmap.md`. Each **step** (e.g. `1.2`) is one
  unit of work, normally one prompt or session.
- **Do exactly one step per session.** Never implement several steps or a whole
  phase in one go. Never build ahead of the roadmap.
- At the start of a step, say which step you are doing and what you will produce.
- At the end of a step:
  1. Run the step's checks (tests, lint, type-check) and report the real results.
  2. Tick the step in `Roadmap.md` and add an entry to
     `docs/08-Roadmap/Progress Log.md` covering what was done, files touched,
     how it was verified, and any follow-ups.
  3. Update every vault note whose content the step changed (module note, API
     endpoints, data model).
  4. **Commit the step** (see §9). If the step completes a phase, also tag it `phase-N`.
  5. **Stop and wait** for the user to approve the next step.
- If a step turns out too large, split it in the roadmap first, then do only the
  first part.
- **Standing authorization (2026-10-17):** the user asked for Phases 1–5 to be developed
  continuously. Until Phase 5 is complete, move straight on to the next step after each
  step's commit instead of stopping. Every per-step rule (verify, docs, one commit) still applies.
  Stop and ask if a step needs a decision only the user can make, or if verification fails and can't be fixed.
  *Fulfilled 2026-10-18 (Phase 5 tagged); from Phase 6 on, stop after every step again.*
- **Standing authorization (2026-10-18):** the user asked to "finish all pending fixes": the follow-up
  fixes (roadmap step 6.0) and then Phase 6 (6.1–6.5) back-to-back, with the same per-step rules
  (verify, docs, one commit each, tag `phase-6`). Stop only for user-only decisions or unfixable failures.
- Open product questions are in `docs/09-Decisions/Open Questions.md`. If a step
  depends on one that is still unresolved, ask the user before building on the default.

---

## 2. Architecture: modular monolith

The system is **one deployable backend** (Django, ASGI) plus **one SPA** (React).
Inside, the code is split **module by module**. Each module owns its models, business
logic, API and tests, and talks to other modules only through their public interface.

### 2.1 Repository layout

```
evaluation-system/
├── AGENT.md                    # this file (rules)
├── CLAUDE.md                   # imports AGENT.md for Claude Code
├── README.md
├── .env.example                # every env var, no real secrets
├── .gitignore
├── .editorconfig
├── .pre-commit-config.yaml     # whitespace/yaml/json checks, gitleaks, ruff (eslint/prettier from 1.5)
├── docker-compose.yml          # dev stack: mysql, redis, backend (Daphne), frontend (Vite)
├── docker/
│   └── mysql/
│       ├── conf.d/choir.cnf    # utf8mb4, strict sql_mode, UTC
│       └── init/               # dev-only first-boot scripts (test DB grants)
├── docs/                       # Obsidian vault: source of truth for docs
├── scripts/                    # backup / restore / dev helper scripts
├── deploy/                     # nginx, prod compose, ASGI config (Phase 6)
├── backend/
│   ├── manage.py
│   ├── pyproject.toml          # ruff + pytest config
│   ├── requirements/
│   │   ├── base.txt            # pinned runtime deps
│   │   ├── dev.txt             # -r base.txt + test/lint deps
│   │   └── prod.txt            # -r base.txt + prod server deps
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   ├── test.py
│   │   │   └── prod.py
│   │   ├── urls.py             # mounts each module's api/urls.py under /api/v1/
│   │   ├── routing.py          # websocket URL routes (Phase 5)
│   │   ├── asgi.py
│   │   └── wsgi.py
│   └── apps/
│       ├── core/               # shared kernel: base models, event bus, permissions, pagination, errors
│       ├── accounts/           # users, roles, status, registration, login, password reset, profile
│       ├── members/            # member profiles, voice sections, directory
│       ├── evaluations/        # criteria, form versions, cycles, evaluations, ratings, comments, revisions, moderation
│       ├── feedback/           # recipient-facing ANONYMISED read model (no models of its own)
│       ├── notifications/      # in-app notifications + websocket consumers
│       ├── reports/            # dashboards, aggregates, exports
│       ├── audit/              # append-only audit log
│       └── system/             # system settings, privacy notice, retention policy
└── frontend/
    ├── package.json
    ├── vite.config.ts          # dev server :5280; proxy /api and /ws → Django :8010
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── app/                # App.tsx, routes.tsx, providers.tsx, layouts/, guards/
        ├── components/         # shared, reusable UI only (no feature logic)
        ├── features/
        │   ├── auth/
        │   ├── dashboard/
        │   ├── members/
        │   ├── evaluations/
        │   ├── feedback/
        │   ├── notifications/
        │   ├── admin/          # super-admin screens (members, cycles, criteria, moderation, audit, settings)
        │   └── reports/
        ├── lib/                # apiClient.ts, queryClient.ts, ws.ts, format.ts
        ├── styles/
        └── test/               # vitest setup, test utils, MSW handlers
```

### 2.2 Backend module layout (every `apps/<module>/` uses this shape)

```
apps/<module>/
├── __init__.py
├── apps.py
├── models.py            # or models/ package when large
├── admin.py             # Django admin registration (super admin only)
├── selectors.py         # PUBLIC read API: query functions that return querysets or DTOs
├── services.py          # PUBLIC write API: use-cases, transactions, validation, emits events
├── events.py            # PUBLIC: domain event names and payload dataclasses this module publishes
├── handlers.py          # subscribers to OTHER modules' events (registered in apps.py ready())
├── permissions.py       # DRF permission classes for this module
├── constants.py         # choices / enums
├── api/
│   ├── __init__.py
│   ├── serializers.py   # member-facing serializers
│   ├── admin_serializers.py  # super-admin serializers (may include identities)
│   ├── views.py         # member-facing views
│   ├── admin_views.py   # super-admin views
│   ├── urls.py          # member-facing routes
│   └── admin_urls.py    # super-admin routes (mounted under /api/v1/admin/)
├── migrations/
└── tests/
    ├── factories.py
    ├── test_models.py
    ├── test_services.py
    ├── test_selectors.py
    ├── test_api.py
    └── test_permissions.py
```

Leave out files a module does not need. Keep the names exactly as above when they exist.

### 2.3 Module boundary rules

1. **Public interface only.** Module A may import from module B only:
   `apps.B.selectors`, `apps.B.services`, `apps.B.events`, `apps.B.constants`.
   Never import B's `api/`, `handlers.py` or private helpers.
2. **Writes go through services.** Never call `.save()`, `.create()`, `.update()` or
   `.delete()` on another module's models. Call that module's service.
3. **Foreign keys across modules are allowed** (for example to `accounts.User`) for
   referential integrity, but logic about a model belongs in the module that owns it.
4. **Views are thin.** Views: authenticate → permission → validate with serializer →
   call service/selector → serialize. There is no business logic in views or serializers.
5. **Side effects travel by events.** Services publish domain events through
   `apps.core.events` (an in-process bus dispatched with `transaction.on_commit`).
   `audit` and `notifications` subscribe. A service never imports `audit` or
   `notifications` directly, with one exception: `audit.services.record()` may be
   called directly when the log entry must be in the same transaction.
6. **Dependency direction** (lower depends on nothing above it):
   `core` ← `system` ← `accounts` ← `members` ← `evaluations` ← `feedback`, `reports`.
   `audit` and `notifications` depend only on `core` (and read `accounts`/`system` selectors;
   `notifications` subscribes to other modules' `events`, ADR-020).
   Circular imports between modules are forbidden.
7. **No cross-module DB joins in views.** If a query needs data from two modules,
   write it as a selector in the module that owns the main entity.
8. **Frontend features** follow the same idea. A feature exports its public pieces
   from `features/<x>/index.ts`. Other features import only from that index.
   Shared UI goes to `components/`, shared non-UI code to `lib/`.

### 2.4 Frontend feature layout

```
features/<feature>/
├── index.ts          # public exports (pages, hooks used elsewhere)
├── api.ts            # axios calls for this feature (uses lib/apiClient)
├── queries.ts        # TanStack Query hooks + query keys
├── schemas.ts        # zod schemas (forms + response parsing where useful)
├── types.ts
├── routes.tsx        # route objects for this feature
├── components/
├── pages/
└── __tests__/
```

---

## 3. PRIVACY RULES (non-negotiable)

The product exists to give **anonymous-to-members** feedback. One leak of an
evaluator's identity is a critical bug.

1. A member must **never** be able to learn who evaluated them: not through UI,
   API responses, URLs, IDs, error messages, notifications, emails, exports, logs,
   WebSocket payloads, browser-visible metadata, ordering or timing.
2. Member-facing feedback goes **only** through `apps/feedback`. Its selectors build
   DTOs that **never select** evaluator columns, using `.values()` or `.only()`
   whitelists. Serializers never use `fields = "__all__"`.
3. Member-facing feedback items do not expose `Evaluation.public_id` or database
   PKs. They use opaque, non-sequential feedback IDs (see Privacy Model).
4. Dates shown to recipients use **day precision** at most. Default ordering is
   not by exact timestamp.
5. Aggregates (averages, trends, breakdowns) shown to a member are **suppressed
   when n < `min_aggregate_group_size`** (system setting, default 3).
6. Only `SUPER_ADMIN` may see evaluator identities. Every super-admin read of an
   identity-bearing record or export is **audit-logged**.
7. Notifications to members contain only safe, generic text, for example "You have new
   feedback". No evaluator name, ID or exact submission time.
8. Revision history is visible only to the **author** and the **Super Admin**. A
   recipient sees only the current content plus an optional "Edited" flag.
9. Every member-facing endpoint has a **privacy test** asserting that no evaluator
   field appears in the payload (see `docs/10-Testing/Testing Strategy.md`).
10. Before submitting, the UI must show the privacy notice: names are hidden from
    members but visible to the Super Admin.

## 4. Security rules

1. **Server-side permission checks are mandatory.** Hiding a button in React is not
   security. Every view declares `permission_classes` explicitly. The DRF default is
   `IsAuthenticated`, and object-level checks go in the service or selector.
2. Roles: `MEMBER`, `SUPER_ADMIN` (on `accounts.User.role`). Use the shared
   permission classes in `apps/core/permissions.py` (`IsActiveMember`,
   `IsSuperAdmin`). Do not check roles inline with ad-hoc `if` statements in views.
3. Auth uses Django **session auth** with HttpOnly, Secure (in prod) and SameSite=Lax
   cookies and **CSRF protection**. SPA and API are same-origin: Vite proxy in dev,
   Nginx in prod. CORS stays off unless an ADR says otherwise.
4. Passwords use Django's hasher (Argon2 if available) and Django password validators.
   Never log or return passwords or tokens.
5. Rate limiting uses DRF throttles on login, registration, password reset and
   evaluation submission.
6. **XSS:** comments are stored as plain text and rendered as text. Never use
   `dangerouslySetInnerHTML`. Enforce length limits server-side.
7. **Secrets:** never commit `.env`, passwords, secret keys, DB credentials or tokens.
   All configuration comes from env vars through `django-environ`, and every
   variable is documented in `.env.example`.
8. Audit log and evaluation revisions are **append-only**. Their models block
   ordinary update and delete. **User-approved exception (2026-10-21, step 7.2):**
   Super Admins may delete ordinary audit entries through the dedicated service/API
   after password and reason confirmation; bulk clearing also requires typed
   confirmation. Each action atomically retains a deletion receipt, which cannot
   be manually deleted. Evaluation revisions remain immutable. See ADR-022.
9. Use soft delete or archival (`is_archived`, `status`) instead of hard deletes for
   users, criteria, cycles and evaluations.
10. Production: HTTPS only, `DEBUG=False`, `manage.py check --deploy` clean,
    restricted `ALLOWED_HOSTS`, least-privilege DB user.

## 5. Business rules (enforced in services, covered by tests)

1. Members cannot evaluate themselves (service check plus DB check constraint).
2. Members create, view and edit **only their own** submitted evaluations,
   subject to cycle settings (open, before the edit deadline).
3. Recipients see feedback content and received counts, never evaluator identity.
4. Only the Super Admin sees evaluator identities and system-wide private records.
5. Every create or edit writes an **immutable `EvaluationRevision`**. Edits never
   silently overwrite.
6. Recipients may see an "Edited" label but never who edited.
7. Criteria and scales are **versioned**. Historical evaluations keep the criterion
   versions they were submitted with.
8. All privileged access, exports, moderation and configuration changes are logged.
9. Each (cycle, evaluator, recipient) pair allows one evaluation unless the cycle allows
   resubmission.
10. Missing ratings are **not zero**. They are excluded from averages, and the count is shown.

## 6. Coding conventions

### Backend (Python 3.12+, Django 5.2 LTS, DRF)
- Format and lint with **Ruff** (`ruff format`, `ruff check`). Line length 100.
- Type hints on all service and selector signatures.
- Services are plain functions with keyword-only args, e.g.
  `def submit_evaluation(*, evaluator: User, recipient_id: int, ...) -> Evaluation:`.
  Wrap multi-write operations in `transaction.atomic()`.
- Raise domain errors from `apps.core.exceptions` (e.g. `ValidationError`,
  `PermissionDenied`, `NotFound`, `BusinessRuleViolation`). The global DRF exception
  handler maps them to the error envelope in `docs/06-API/API Conventions.md`.
- Models: inherit `core.models.TimeStampedModel`. Externally exposed entities get a
  `public_id = UUIDField(unique=True, default=uuid4)`. Never expose integer PKs in URLs.
- Custom user model `accounts.User` must exist **before the first migration**.
- MySQL: `utf8mb4` / `utf8mb4_unicode_ci`, strict mode, index the columns used in filters.
- Pagination is on for every list endpoint. Avoid N+1 queries
  (`select_related`/`prefetch_related`). Tests may assert query counts.
- No raw SQL unless an ADR justifies it.

### Frontend (React + Vite + TypeScript)
- TypeScript `strict: true`. No `any` without a comment explaining why.
- Server state lives in **TanStack Query** only. Do not copy server data into local state.
- Forms use **React Hook Form + Zod**. The schemas mirror backend validation, but the
  backend stays authoritative.
- HTTP uses **axios** through `lib/apiClient.ts` only. It sends credentials and the
  CSRF header automatically.
- UI uses **MUI** components plus a theme in `styles/`. Charts use **Recharts**.
- Accessibility: every input labelled, keyboard reachable, visible focus, WCAG AA
  contrast, responsive from 360px wide.
- ESLint + Prettier clean. Components are `PascalCase.tsx`, hooks `useX.ts`.

### Naming
- Python modules and functions `snake_case`, classes `PascalCase`.
- API paths are lowercase kebab-case plural nouns: `/api/v1/evaluation-cycles/`.
- Domain event names are `module.entity.past_tense_verb`, e.g. `evaluations.evaluation.submitted`.

## 7. Testing rules

- Backend: `pytest` + `pytest-django` + `factory-boy`. Frontend: `vitest` +
  React Testing Library (+ MSW). E2E: Playwright (Phase 6).
- Every module ships tests for **services** (business rules), **permissions**
  (member vs super admin vs anonymous vs suspended), and **API**.
- Every member-facing endpoint that touches evaluations has a **privacy-leak test**.
- A bug fix comes with a test that reproduces the bug.
- Tests run against **MySQL** (docker-compose), the same engine as production.
- Never skip, delete or weaken a failing test to make a build pass. Report it instead.

## 8. Dependencies

- Add a package only in the step whose feature needs it, never "in advance".
- Pin versions (`requirements/*.txt`, `package-lock.json`). Record why a new
  package was added in the Progress Log.
- Confirm compatibility (Django 5.2 LTS, Python 3.12, Node LTS) before adding.

## 9. Git & change hygiene

- **Every step ends with exactly one commit**, made after verification and doc updates.
  Use Conventional Commits and name the step, e.g.
  `feat(accounts): step 1.4 accounts + registration`. The body lists what changed and how it was verified.
- **Every completed phase gets an annotated tag**: `git tag -a phase-N -m "Phase N: <name> complete"`.
- Commit on `main` (local repo, no remote yet). Never force-push, rewrite or amend published history.
- Pre-commit hooks must pass. Never use `--no-verify`.
- One step = one focused set of changes. No drive-by refactors outside the step.
- Never commit `.env`, DB dumps, backups, `node_modules`, build output or the
  `docs/.obsidian/workspace*.json` files.

## 10. Documentation rules

- `docs/` is the source of truth. When behaviour, endpoints, models or rules change,
  update the matching note **in the same step**.
- Use Obsidian wikilinks (`[[Evaluations]]`) between notes. Requirement IDs
  (`EVAL-03`, `PRIV-02`, ...) link code, tests and docs. Put the ID in test docstrings.
- Every significant choice gets an entry in `docs/09-Decisions/Decisions Log.md`
  (template in `docs/Templates/`).

## 11. Definition of done (per step)

- [ ] Code follows the module layout and boundary rules above.
- [ ] Server-side permissions and business rules enforced and tested.
- [ ] Privacy tests pass for any member-facing evaluation data.
- [ ] `ruff check`, `ruff format --check`, `pytest` pass (backend touched).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` pass (frontend touched).
- [ ] Migrations created and committed with the model changes.
- [ ] Vault notes, Roadmap checkbox and Progress Log updated.
- [ ] No secrets, no debug leftovers, no unrelated changes.

## 12. Commands

Filled in during Phase 1 as the tooling becomes real. Do not invent commands that
do not exist yet.

```bash
# environment (once): copy and fill secrets, never commit .env
cp .env.example .env

# everything in Docker (ADR-019): http://localhost:5280 (SPA) · http://localhost:8010 (API)
docker compose up -d --build
docker compose ps                    # mysql, redis, backend "(healthy)"; frontend "Up"
docker compose exec backend pytest   # backend tests on MySQL, inside the container
docker compose exec backend ruff check . && docker compose exec backend ruff format --check .
docker compose exec backend python manage.py createsuperuser   # or create_super_admin (below)
docker compose logs -f backend frontend

# or infrastructure only: MySQL → 127.0.0.1:3307, Redis → 127.0.0.1:6380 (override via MYSQL_HOST_PORT / REDIS_HOST_PORT)
docker compose up -d mysql redis

# git hooks (once): pre-commit lives in backend/.venv
backend/.venv/bin/pre-commit install
backend/.venv/bin/pre-commit run --all-files

# backend (from backend/)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
SUPER_ADMIN_PASSWORD='…' python manage.py create_super_admin \
    --email you@example.org --username you --first-name You --last-name Admin
python manage.py runserver 8010     # dev port 8010 (ADR-016); ASGI via daphne from Phase 5
pytest
ruff check . && ruff format --check .

# frontend (from frontend/)
npm install
npm run dev                          # http://localhost:5280
npm run test
npm run lint && npm run typecheck && npm run format:check
npm run build
```
