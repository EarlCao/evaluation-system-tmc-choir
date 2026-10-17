---
tags: [decisions, adr]
---
# Decisions Log (ADRs)

Format: [[ADR Template]]. Status: Proposed · Accepted · Superseded.

| ADR | Title | Status | Date |
|---|---|---|---|
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

---

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
