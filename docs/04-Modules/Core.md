---
tags: [module]
module: core
phase: 1
status: implemented (step 1.2)
---
# Module: Core (shared kernel)

Deployment review (2026-10-21): CORS is restricted to explicit configured origins,
supports the registration header, and always varies by Origin. Production requires
strong independent secrets, HTTPS URLs, SMTP, Gmail API or Brevo API email, and shared Redis;
the permission matrix covers backup routes. See [[Deployment Readiness 2026-10-20]].

**Backend:** `apps/core` · **Frontend:** `src/lib`, `src/components`, `src/app`

## Responsibility
Shared technical building blocks with **no business logic**. Every module may depend
on `core`. `core` depends on nothing in `apps/`.

## Contents
| Item | Purpose |
|---|---|
| `models.TimeStampedModel` | `created_at`, `updated_at` |
| `models.PublicIdModel` | `public_id = UUIDField(unique, default=uuid4, editable=False)` |
| `models.AppendOnlyModel` | raises on update of an existing row and on delete (audit, revisions, moderation) |
| `events.publish / subscribe` | in-process domain event bus; dispatch on `transaction.on_commit` |
| `events.DomainEvent` | frozen dataclass base. Envelope: `actor_id`, `target_id` fields; `name`, `target_type`, `audited` class vars (ADR-014) |
| `exceptions.*` | `DomainError`, `BusinessRuleViolation`, `NotFound`, `PermissionDenied`, plus DRF exception handler → error envelope |
| `authentication.SessionAuthentication` | session auth + CSRF; 401 for unauthenticated |
| `permissions.IsActiveMember`, `IsSuperAdmin` | role/status checks via `user.is_active_member` / `user.is_super_admin` (provided by `accounts.User`, step 1.4) |
| `pagination.DefaultPagination` | page-number pagination, `page_size` default 20, max 100 |
| `middleware.RequestContextMiddleware` | stores request IP / user agent for audit (contextvar) |
| `middleware.request_context(ctx)` | sets the context explicitly (tests, management commands, jobs) |
| `api/health.py` | `GET /api/v1/health/` → `{status, db}` (redis check added in 5.1) |
| `testing/privacy.py` | `assert_no_evaluator_leak` (identity keys + identifying values) |
| `backend/conftest.py` | `api_client`, `csrf_api_client` fixtures (`member` / `super_admin` fixtures arrive with accounts in 1.4) |
| `tests/testapp/` | test-only app (installed by `config.settings.test`) with concrete models for the abstract bases |

`email_backend.GmailEmailBackend` sends Django MIME email over HTTPS using the sender's
OAuth refresh token. Production validates credentials; failures propagate without logging
message bodies or tokens. Rejected HTTP requests log only the endpoint label, status
and an allowlisted provider error code; all other response content stays private.
See [[Gmail on Render Free]].

`email_backend.BrevoEmailBackend` supports verification/reset mail over HTTPS with
`BREVO_API_KEY` and a verified sender. Shared API diagnostics log only allowlisted
provider codes; production validates configuration before serving. See [[Brevo on Render Free]].

## Frontend counterparts
`lib/apiClient.ts` (axios + CSRF), `lib/queryClient.ts`, `lib/ws.ts`, `lib/format.ts`,
`components/*` shared UI, `app/*` router, providers, layouts and guards.

## Tests (`apps/core/tests/`, 64 tests)
- Event bus dispatches only after commit, and not at all on rollback. Base-class subscription; failing handler isolation.
- `AppendOnlyModel` blocks update and delete.
- Exception handler produces the envelope from [[API Conventions]].
- Permissions: anonymous / inactive / member / inactive super admin / super admin.
- Pagination envelope and max page size; request-context middleware (XFF only when enabled, last hop); health ok/503; schema locked outside dev; OpenAPI schema validates with `--fail-on-warn`; privacy helper.

Related: [[Module Boundaries]] · [[Backend Structure]]
