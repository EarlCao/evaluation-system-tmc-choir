---
tags: [roadmap]
---
# Roadmap

> [!important] How to use
> - Do **one step per session/prompt**. The current step is the **first unchecked box**.
> - When a step is done, tick it, add an entry to [[Progress Log]], update the affected
>   notes, **commit the step** (one commit per step; tag `phase-N` when a phase completes),
>   then **stop** and wait for approval of the next step.
> - Each step lists **Done when** criteria. All of them must be verified.

## Phase 0: Documentation & Rules
- [x] **0.1** Read the specification; create the Obsidian vault, `AGENT.md` and `CLAUDE.md`.
  - Done when: the vault covers every section of [[Source Requirements]], and the rules and architecture are documented.

## Phase 1: Foundation
- [x] **1.1 Repository scaffolding**: `git init`, `.gitignore`, `.editorconfig`, `.env.example`,
  `docker-compose.yml` (MySQL 8 + Redis 7 with healthchecks and volumes), `README.md`,
  `.pre-commit-config.yaml`, empty `backend/` and `frontend/` folders.
  - Done when: `docker compose up -d mysql redis` is healthy and `git status` shows no secrets.
- [x] **1.2 Backend skeleton + core**: Django 5.2 project `config/` with split settings,
  django-environ, MySQL connection (utf8mb4), DRF + drf-spectacular, `apps/core`
  (base models, event bus, exceptions + handler, permissions, pagination, request
  context middleware, health endpoint), pytest + ruff config.
  - Done when: `pytest` passes core tests on MySQL, `/api/v1/health/` returns ok, `/api/docs/` loads, and ruff is clean.
- [x] **1.3 System + Audit foundations**: `apps/system` (SystemSettings singleton,
  selectors, admin registration) and `apps/audit` (AuditLog append-only, `record()`,
  event handler registry).
  - Done when: append-only tests pass, settings are cached, and an event published in a test produces an AuditLog row after commit.
- [x] **1.4 Accounts + registration**: custom `User` (first migration), roles and status,
  `members` minimal (`VoiceSection` seed + `MemberProfile`) for registration,
  `register_member`, login/logout/me/csrf, password change/reset (console email), throttles,
  `create_super_admin` command, audit events.
  - Done when: tests cover each registration mode, generic login errors, blocked pending/suspended users, throttles, and audit rows.
- [x] **1.5 Frontend skeleton**: Vite + React + TS (strict), ESLint/Prettier, MUI theme,
  React Router with layouts and guards, TanStack Query, axios `apiClient` with CSRF,
  Vitest + RTL + MSW, Vite proxy to Django.
  - Done when: `npm run lint/typecheck/test/build` pass, and the app shell loads and calls `/api/v1/health/` through the proxy.
- [x] **1.6 Frontend auth pages**: Login, Register (with voice section), Forgot/Reset Password,
  Verify Email, Profile, logout, pending-approval screen (Welcome page, `useCurrentUser` and guards were done in 1.5).
  - Done when: you can register, log in and log out end-to-end against the real backend, and component tests pass.

## Phase 2: Member & Evaluation Flow
- [x] **2.1 Member directory**: `members` selectors and API (search, filter, paginate,
  django-filter), member profile; frontend directory and profile pages; member dashboard
  placeholder plus `GET /dashboard/`.
- [x] **2.2 Evaluation configuration (backend)**: categories, criteria + versions, form
  versions + publish, cycles + open/close, admin APIs, validation, `seed_demo_data` command.
- [x] **2.3 Evaluation submission (backend)**: eligibility endpoint, current cycle and
  form endpoints, `submit_evaluation` (all rules BR-01/12/13/14, revision 1), my
  evaluations list and detail, throttle, privacy notice in `system/public`.
- [x] **2.4 Evaluate & My Evaluations (frontend)**: dynamic form from form version,
  RatingInput per scale, counters, review & confirm with PrivacyNotice, success page;
  My Submitted Evaluations list and detail.

## Phase 3: Feedback Privacy & Revisions
- [x] **3.1 Editing & revisions (backend)**: `edit_evaluation` within edit window,
  immutable revisions, `is_edited`, revisions API (author), events.
- [x] **3.2 Feedback module (backend)**: `apps/feedback` anonymised list, summary and
  count; opaque IDs; thresholds; visibility rules; full privacy tests.
- [x] **3.3 Frontend: edit, history & feedback**: edit flow, revision timeline/diff,
  Feedback I Received page with anonymity banner, cards and Recharts trend.
- [x] **3.4 Privacy hardening sweep**: run `assert_no_evaluator_leak` across **every**
  member endpoint, review logs and error messages, and document results.

## Phase 4: Super Admin (God Mode)
- [x] **4.1 Admin shell + dashboard stats** (ADM-01)
- [x] **4.2 Member & role management**: approvals, status, roles, voice sections (AUTH-05, MEM-05)
- [x] **4.3 Cycles, criteria & form management UI** (EVAL-02, CFG-*)
- [x] **4.4 All evaluations browser + moderation** with identity-access auditing (ADM-02/03/05)
- [x] **4.5 Reports & exports**: CSV/XLSX/PDF, audited (REP-*, ADM-07)
- [x] **4.6 Audit log viewer + System settings + Privacy page** (AUD-04, SET-01, SET-03)

## Phase 5: Real-Time
- [x] **5.1 Channels foundation**: channels, channels-redis, daphne, ASGI routing,
  Notification model + REST API.
- [x] **5.1a Docker dev stack** (user request 2026-10-18, ADR-019): backend + frontend services in docker-compose.
- [x] **5.2 Event handlers & consumers**: safe notifications, debounce, user/admin groups, WS auth.
- [x] **5.3 Frontend realtime**: notification bell and center, `ws.ts` reconnect +
  polling fallback, live admin dashboard counts.

## Phase 6: Quality & Deployment
- [x] **6.0 Follow-up fixes**: lazy-load the admin area (bundle size), warn when a comment contains the writer's own
  name, automatically close periods after their end date.
- [x] **6.1 Test & security sweep**: permission matrix tests, module import-boundary
  check, Playwright e2e for key flows.
- [x] **6.2 Accessibility pass**: keyboard, contrast, labels, responsive, axe checks.
- [x] **6.3 Production configuration**: Dockerfiles, prod compose, Nginx + HTTPS,
  secure cookies, CSP, `check --deploy`.
- [x] **6.4 Data management**: backup/restore scripts + restore drill, retention job,
  member data export and deactivation workflow.
- [x] **6.5 Final acceptance**: walk through [[Acceptance Checklist]] with evidence.

## Phase 7: Deployment readiness review
- [x] **7.1 Pre-deployment audit and remediation** (user request 2026-10-20): review all
  modules, fix verified security and deployment defects, reconcile migrations and
  acceptance evidence, and run backend, frontend, browser, and production checks.
  - Done when: checks pass and [[Deployment Readiness 2026-10-20]] records the actual
    results, deployment procedure, and any infrastructure-dependent launch gates.

- [x] **7.2 Controlled audit-log deletion** (user request 2026-10-21): Super Admin
  single-entry deletion and Clear All, password/reason confirmation, typed bulk
  confirmation, retained deletion receipts, CSRF/rate limits and regression tests.

- [x] **7.3 Vercel API routing repair** (user request 2026-10-22): reproduce the live
  trailing-slash routing failure and add explicit slash-preserving proxy rules to both
  Vercel configurations. Post-deployment endpoint verification is recorded separately.

- [x] **7.4 Admin logout navigation** (user request 2026-10-22): return Super Admins
  to `/admin` after logout even when clearing session state unmounts the account menu;
  cover dashboard/subpage logout and member navigation with regression tests.

- [x] **7.5 Gmail delivery on Render Free** (user report 2026-10-22): add a Gmail
  HTTPS API backend, explicit email backend selection, production validation, OAuth
  deployment instructions, and email delivery/security regression coverage.

- [x] **7.6 Gmail delivery diagnostics** (continued user report 2026-10-22): retain
  safe endpoint/status/provider error categories in Render logs so deployment email
  failures can be diagnosed without exposing OAuth credentials or message content.

- [x] **7.7 Registration delivery retry allowance** (user report 2026-10-22): prevent
  failed email delivery from consuming hourly registration allowance, bound rapid
  outage retries, and retire counters that charged users for server failures.

- [x] **7.8 Brevo HTTPS email delivery** (user request 2026-10-22): add API-key
  delivery, production checks and Render configuration plus verified-sender/account
  setup instructions; test OTP verification and delivery failures without live mail.
