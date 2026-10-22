---
tags: [decisions, adr]
---
# Decisions Log (ADRs)

Deployment review (2026-10-21): restore append-only audit access and archival removal;
share expiring registration/throttle state through Redis; count distinct contributors;
register public directory readers to preserve dependency direction; complete SMTP
delivery before success without a secret-printing fallback. See [[Deployment Readiness 2026-10-20]].

### ADR-023: Gmail API delivery on Render Free
**Date:** 2026-10-22 · **Status:** Accepted
**Context:** Render Free blocks Gmail SMTP ports, preventing registration OTP delivery.
The user prefers Gmail as the sender.
**Decision:** support Gmail's HTTPS API using sender-only OAuth refresh credentials
and the `gmail.send` scope. Explicit email backend configuration wins over old SMTP
credentials. Keep SMTP for compatible hosting. Use standard-library HTTPS and Django
MIME serialization; no new dependencies. Delivery errors keep generic registration
503 responses and never log tokens or message bodies.
**Consequences:** Google sender consent and private deployment credentials are required.
Testing-mode refresh tokens expire after seven days. Google account limits and token
revocation still affect availability. See [[Gmail on Render Free]].

### ADR-024: Brevo HTTPS email option
**Date:** 2026-10-22 · **Status:** Accepted
**Context:** the user requests switching from Gmail OAuth to Brevo for Render Free.
**Decision:** support Brevo API-key authentication over HTTPS with a verified sender;
make it the Render Blueprint's email default while retaining explicitly selectable
Gmail and SMTP backends. Require provider acceptance before reporting success and
retain safe diagnostics and delivery-aware registration retries. No new dependencies.
**Consequences:** Brevo onboarding, transactional activation, sender verification and
credits remain operational prerequisites. Gmail-domain senders may be rewritten by
Brevo; authenticating an owned domain is recommended. See [[Brevo on Render Free]].

Format: [[ADR Template]]. Status: Proposed · Accepted · Superseded.

| ADR | Title | Status | Date |
|---|---|---|---|
| ADR-024 | Brevo HTTPS email option | Accepted | 2026-10-22 |
| ADR-023 | Gmail API delivery on Render Free | Accepted | 2026-10-22 |
| ADR-001 | Modular monolith (single Django ASGI app + SPA, module-by-module) | Accepted | 2026-10-17 |
| ADR-002 | Services/selectors layering with in-process domain events | Accepted | 2026-10-17 |
| ADR-003 | Session auth + CSRF, same-origin (Vite proxy / Nginx), no CORS | Accepted | 2026-10-17 |
| ADR-004 | Registration orchestrated by `members`; eligibility served by `evaluations` | Accepted | 2026-10-17 |
| ADR-005 | MUI as UI library (over shadcn/ui) | Accepted | 2026-10-17 |
| ADR-006 | axios as the single HTTP client | Accepted | 2026-10-17 |
| ADR-007 | Ruff for lint **and** format (replaces Black) | Accepted | 2026-10-17 |
| ADR-008 | TypeScript (strict) for the frontend | Accepted | 2026-10-17 |
| ADR-009 | Separate `feedback` read-model module for recipient views | Accepted | 2026-10-17 |
| ADR-010 | Criterion and form versioning via immutable version tables | Accepted | 2026-10-17 |
| ADR-011 | Tests run against MySQL, not SQLite | Accepted | 2026-10-17 |
| ADR-012 | Business-rule violations return 409 Conflict | Accepted | 2026-10-17 |
| ADR-013 | Privacy floor: `min_aggregate_group_size` ≥ 3 | Accepted | 2026-10-17 |
| ADR-014 | Audit records every domain event generically (event envelope) | Accepted | 2026-10-17 |
| ADR-015 | Frontend toolchain versions: TypeScript 6.0 (not 7), React Router 8 | Accepted | 2026-10-17 |
| ADR-016 | Project dev ports: Django 8010, Vite 5280 | Accepted | 2026-10-17 |
| ADR-017 | One open cycle enforced by a nullable-unique `is_current` column | Accepted | 2026-10-17 |
| ADR-018 | Exports: stdlib csv, openpyxl, reportlab; formula-injection guard; synchronous audit | Accepted | 2026-10-17 |
| ADR-019 | Containerised dev stack (backend + frontend services in docker-compose) | Accepted | 2026-10-18 |
| ADR-020 | Feedback notices: pending rows + worker/lazy delivery; enriched events; best-effort WS push | Accepted | 2026-10-18 |
| ADR-021 | Deployment hardening: shared challenges, explicit origins, immutable history and recovery | Accepted | 2026-10-21 |
| ADR-022 | Explicitly confirmed Super Admin audit deletion with retained receipts | Accepted (user request) | 2026-10-21 |

---

### ADR-022: Controlled audit-log deletion
**Context:** after being told that deletion changes the append-only policy, the user
explicitly requested single-entry deletion and Clear All. This is step 7.2 and
supersedes ADR-021's absolute prohibition on manual audit deletion only.
**Decision:** keep model-level append-only guards and immutable evaluation revisions.
Only active Super Admins may call a dedicated atomic deletion service/API, supplying
their current password and a reason; bulk clearing also requires the exact phrase
`DELETE ALL LOGS`. Session CSRF and five deletion attempts/minute/user apply. Clear
All affects ordinary entries across every filter, explicitly stated in the dialog.
Each action records actor, target where applicable, reason and deleted count in a
new receipt. Manual deletion excludes/rejects receipt events; policy-based age
retention remains available. Failure to record the receipt rolls back the deletion.
**Consequences:** Super Admins can intentionally erase ordinary historical activity;
the audit is no longer an undeletable record of all actions. Minimal deletion receipts
remain, but do not reconstruct removed content. Export/back up first; recovering
removed entries requires a prior backup. This feature does not delete any existing
logs during implementation or tests; destructive browser tests enforce the isolated
E2E environment. No new packages or schema migrations are required.

### ADR-021: Deployment hardening and recovery
**Context:** the readiness audit found process-local registration state, approval and
privacy defects, unsafe deletion paths, and production/recovery configuration gaps.
**Decision:** require shared Redis in production for expiring registration challenges,
guess counters, throttles and settings; retain only password hashes in pending state.
Complete SMTP delivery synchronously without logging secrets (generic password-reset
responses even on SMTP failure). Prefer ADR-003's same-origin deployment; existing
separate-origin support is allowed only through explicit CORS/CSRF/WS allowlists and
masked CSRF response tokens, never authentication tokens in browser storage.
Archive criteria/categories and prohibit arbitrary audit deletion. Count distinct
contributors before exposing member aggregates. Use author-scoped tab drafts cleared
on session changes. JSON restore preserves existing immutable history and merges rows;
checksummed SQL backups with a pre-restore snapshot are the full recovery mechanism.
Pin the verified Python production base by digest and update it deliberately.
**Consequences:** Redis/SMTP availability and backup permissions are operational
requirements; off-host recovery and live cookie/email checks remain launch gates.
Cross-module directory enrichment uses registered public readers to preserve the DAG.
Public self-reflections are preserved pending the separate BR-01 policy decision;
this ADR does not resolve that product conflict. See [[Deployment Readiness 2026-10-20]].

### ADR-001: Modular monolith
**Context:** one choir, modest load, a small team, and the spec asks for "separate Django apps by responsibility".
**Decision:** one deployable Django ASGI backend and one React SPA. Code is split into modules (`apps/*`, `features/*`) with enforced boundaries ([[Module Boundaries]]).
**Consequences:** simple ops and transactions. Boundaries depend on discipline and are checked in Phase 6.

### ADR-002: Services/selectors + domain events
**Decision:** writes go through `services.py`, reads through `selectors.py`, and side effects (audit, notifications) go through events dispatched on commit.
**Consequences:** thin views, testable rules, loose coupling with audit and notifications.

### ADR-003: Session auth, same-origin
**Decision:** Django sessions with HttpOnly cookies and CSRF. Vite proxy in dev, Nginx in prod. No JWT, no CORS.
**Consequences:** no tokens in JS storage, which is safer. The WebSocket also authenticates with the session.

### ADR-004: Registration in `members`, eligibility in `evaluations`
**Context:** registration needs User + MemberProfile atomically, but `accounts` must not depend on `members`. Showing "can evaluate" on a profile must not make `members` depend on `evaluations`.
**Decision:** `members.services.register_member` orchestrates. The eligibility endpoint lives in `evaluations`.

### ADR-005: MUI
**Decision:** MUI. It comes with accessible components, theming and data-grid-like tables, and needs no Tailwind toolchain.

### ADR-006: axios
**Decision:** one axios instance (CSRF header and interceptors are simple). The native fetch API is not used directly.

### ADR-007: Ruff only
**Decision:** `ruff format` is Black-compatible, so a single tool handles lint and format.

### ADR-008: TypeScript strict
**Decision:** TS with `strict: true`. It shares Zod-inferred types between forms and API.

### ADR-009: Feedback read model
**Decision:** recipient views go only through `apps/feedback`, with whitelisted rows, opaque IDs and thresholds. See [[Privacy Model]].

### ADR-010: Versioned criteria and forms
**Decision:** immutable `CriterionVersion` and `FormVersion` tables. Evaluations reference versions. See [[Data Model]].

### ADR-011: MySQL in tests
**Decision:** pytest runs on MySQL (Docker) to catch collation, strict-mode and constraint differences.

### ADR-012: 409 for business-rule violations
**Context:** API Conventions left 409 vs 422 open for `business_rule_violation`.
**Decision:** **409 Conflict.** The rules are mostly state conflicts (cycle closed, duplicate submission, edit window passed, self-evaluation). Field-level input problems stay 400 `validation_error`.
**Consequences:** the frontend treats 409 as "show the message, do not map to fields".

### ADR-013: Privacy floor for aggregates
**Context:** with n=2, a recipient who knows one evaluator can deduce the other's ratings from the average.
**Decision:** `min_aggregate_group_size` defaults to 3 and **cannot be set lower** (model validator). The Super Admin may raise it.
**Consequences:** very small groups never see averages. To change the floor, write a new ADR.

### ADR-014: Generic auditing through the event envelope
**Context:** BR-08 requires every privileged or configuration change to be logged, and writing one handler per event would be error-prone.
**Decision:** `DomainEvent` carries `actor_id`, `target_id` (fields) and `target_type`, `audited` (class vars). `audit.handlers` subscribes to the base class and records every event. Configuration events may include `changes` tuples, which become before/after.
**Consequences:** a new event is audited by default. Payloads must stay free of personal content because they land in `metadata`.

### ADR-015: Frontend toolchain versions
**Context:** in Oct 2026 the latest TypeScript is 7.0, but typescript-eslint 8.71 supports only `>=4.8.4 <6.1.0`.
**Decision:** pin **TypeScript 6.0.3**. Use React Router 8 through the `react-router` package (`react-router-dom` is no longer needed).
**Consequences:** move to TS 7 once typescript-eslint supports it. Re-check peer ranges with `npm view <pkg> peerDependencies` before any upgrade.

### ADR-016: Non-default dev ports
**Context:** ports 8000, 5173 and 5180 are already used by other projects on the developer machine (MySQL/Redis were moved to 3307/6380 for the same reason).
**Decision:** Django dev server on **8010**, Vite on **5280** (overridable with `VITE_BACKEND_URL` / `FRONTEND_PORT`).
**Consequences:** `.env.example` uses `FRONTEND_URL` / `CSRF_TRUSTED_ORIGINS` = `http://localhost:5280`.

### ADR-017: One open cycle, enforced by the database
**Context:** at most one cycle may be OPEN, so a member's evaluation always has an unambiguous cycle. MySQL has no partial unique indexes, and a check in code alone can race.
**Decision:** `EvaluationCycle.is_current` is `True` while OPEN and `NULL` otherwise, with a **unique** index (MySQL allows many NULLs). `open_cycle` sets it in a transaction and maps an `IntegrityError` to a 409.
**Consequences:** concurrent opens cannot both succeed. Closing sets the column back to NULL.

### ADR-018: Export formats and libraries
**Context:** ADM-07 asks for CSV, Excel and PDF exports. Exports leave the system, may carry identities (REP-05) and contain
free text written by members.
**Decision:** CSV with the stdlib `csv` module (UTF-8 with BOM for Excel), Excel with **openpyxl**, PDF with **reportlab**
(pure-Python wheels; weasyprint was rejected because it needs Pango/Cairo system libraries in every image). Reports build one
neutral `Document` (titled tables) that each renderer draws. Cells that a spreadsheet would treat as formulas (`= + - @`, tab,
CR) are prefixed with `'` in CSV/XLSX and stored as text; PDF text is XML-escaped and shown as written. Every export is
written to the audit log **synchronously** before the response (no file without an audit row). Filenames carry no names
(`member-summary-<8 hex of public_id>-<date>.pdf`). Exports are plain GET links (session cookie), throttled 60/hour.
**Consequences:** no system packages; files are built in memory (fine at choir scale; stream if a choir ever has tens of
thousands of evaluations). The evaluator-detail export is CSV/Excel only (too wide for a page).

### ADR-019: Containerised development stack
**Context:** the user asked to run the project in Docker (2026-10-18). The host lacks the MySQL client headers that
`mysqlclient` needs, so backend checks had been running in a throwaway image; Phase 5 adds an ASGI server (Daphne) and Redis.
**Decision:** `docker-compose.yml` gains `backend` (`backend/Dockerfile.dev`, Daphne via `runserver`, repo bind-mounted,
migrations on start, healthcheck) and `frontend` (`frontend/Dockerfile.dev`, Vite dev server, `node_modules` in a named
volume, polling file watch). DB/Redis URLs are overridden to service names; host ports stay 127.0.0.1-only. Running on the
host (`docker compose up -d mysql redis` + local servers) still works. Production images are separate (`deploy/`, Phase 6).
**Consequences:** one command starts the whole system; backend tests run with `docker compose exec backend pytest`
(same MySQL as before). Dev images are not hardened and must not be deployed.

### ADR-020: Debounced feedback notices and realtime delivery
**Context:** RT-02 / Privacy Model: a "new feedback" notification sent at submission time tells the recipient *when* someone
evaluated them, which can identify the evaluator. There is no task queue (Celery) in the stack. The notifications module
may depend only on lower modules.
**Decision:** a submission creates (or joins) a `PendingFeedbackNotice` with `deliver_after = first submission +
feedback_notification_debounce_minutes`; AFTER_CLOSE cycles hold it (`deliver_after` NULL) until `evaluations.cycle.closed`.
Due notices become one generic notification per member (none while an earlier one is unread). Delivery runs from
`manage.py deliver_notifications --loop 60` (compose `worker`, cron in production) **and** lazily when a member reads their
notifications, so it works without the worker. Events carry what notifications need (`cycle_name`, `feedback_visibility`,
`cycle_id`) instead of notifications querying evaluations; it reads only `accounts`/`system` selectors. WebSocket pushes
happen after commit and are best effort (failures logged; REST is the source of truth, RT-05). Suspending/deactivating a
user closes their sockets (`session.revoked`, close code 4001).
**Consequences:** notification time is decoupled from submission time by up to the window (0 = immediate, an admin choice);
the worker adds one container; the failed-login alert counts in the Django cache (per process in dev).
