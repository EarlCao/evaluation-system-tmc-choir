---
tags: [module, security]
module: audit
phase: 1 (model + handlers), 4 (viewer UI)
status: model + record + event handler (1.3), viewer API/UI + export (4.6) implemented
---
# Module: Audit

Deployment review (2026-10-21): arbitrary API deletion and UI delete controls were
removed to restore AUD-03. Retention remains the deletion mechanism. Backup downloads
are audited; JSON recovery cannot rewrite existing immutable history.
See [[Deployment Readiness 2026-10-20]].

**Policy update (step 7.2, explicitly requested 2026-10-21):** the Super Admin may
delete ordinary entries or clear ordinary logs through a guarded exception (ADR-022).
The API requires the current password and a reason; Clear All additionally requires
`DELETE ALL LOGS` and applies across filters. Each action atomically writes a retained
`audit.entry.deleted` or `audit.logs.cleared` receipt with actor, reason and count.
Receipts cannot be manually deleted (409); age-based retention still applies.
Existing backups are the only recovery mechanism. Ordinary ORM deletes/updates and
all evaluation-revision changes remain forbidden. This supersedes the read-only API
description below only for confirmed DELETE requests.

**Backend:** `apps/audit` · **Frontend:** `features/admin` (audit log viewer)
**Requirements:** AUD-01..05 · **Rules:** BR-08

## Responsibility
An append-only record of security-sensitive events. It mostly consumes domain events;
it is also called directly for **sensitive read access**. It is built in Phase 1 so every
later module is audited from day one.

## Model
**`AuditLog`** (`AppendOnlyModel`)
| Field | Notes |
|---|---|
| `id` | bigint |
| `occurred_at` | indexed |
| `actor` | FK User, nullable (anonymous or system), `on_delete=PROTECT` |
| `actor_role` | snapshot of role at the time |
| `event_type` | e.g. `accounts.user.login_failed`, `admin.sensitive_access` (indexed) |
| `target_type`, `target_id` | affected record (indexed together) |
| `before`, `after` | JSON, nullable. **Never contains passwords or tokens** |
| `metadata` | JSON (filters used, reason, counts) |
| `ip_address`, `user_agent`, `request_id` | from `RequestContextMiddleware`. Retention per [[System Settings]] |

## Events recorded (AUD-01)
Login success/failure, logout, registration, approval, status/role changes, password
reset request/complete, evaluation create/edit (IDs only, no content; the content
history lives in `EvaluationRevision`, AUD-05), criterion/form/cycle changes,
moderation, exports, settings changes, admin sensitive access.

## How events become entries (ADR-014)
`handlers.record_domain_event` subscribes to the **base** `DomainEvent`, so every event is
audited unless its class sets `audited = False`. Mapping:
`event.name` → `event_type`, `actor_id` → `actor` (+ `actor_role` snapshot),
`target_type`/`target_id` → target, `changes` → `before`/`after`, and the remaining
payload fields → `metadata`. Entries are written after commit, so rolled-back work leaves no entry.

## Services / selectors
- `record(*, event_type, actor=None, actor_id=None, target_type="", target_id=None, before=None, after=None, metadata=None)`
  (implemented). Takes IP, user agent and request id from the current request context, and
  **redacts** values whose keys look sensitive (`password`, `secret`, `token`, `api_key`, `session`) at any depth.
- `admin_search_logs(filters)` (actor, event_type, target, date range; paginated)
- `export_logs(filters, format)` (itself audited)

## API
`GET /api/v1/admin/audit-logs/` · `GET /api/v1/admin/audit-logs/{id}/` ·
`GET /api/v1/admin/audit-logs/export/`. No POST/PUT/PATCH. DELETE on the collection
or detail requires the step 7.2 confirmation payload and active Super Admin role.

## Tests
Implemented (step 1.3): append-only (instance and queryset update/delete raise; a referenced actor
cannot be deleted); `record` fields, actor resolution, role snapshot, request context and
redaction; the handler writes a row only after commit, skips rollbacks and `audited=False`;
settings changes are audited end-to-end.
Later: members get 403 on the viewer API (4.6); the export itself is logged.

Related: [[Security Model]] · [[Module Boundaries]]

## Implementation notes (step 4.6): viewer & export
- `selectors.list_logs(search, event_type, actor, target_type, target_id, occurred_from, occurred_to)` (newest first;
  `event_type` ending in `.` is a prefix), `get_log(pk)`, `list_event_types()`.
- API (namespace `audit-admin`, Super Admin only): list (paginated), detail, event types, export. Originally read-only;
  step 7.2 adds the guarded DELETE exception. PUT/PATCH remain 405. `AppendOnlyModel` still refuses updates/deletes underneath (a test fixture that tried to back-date a row
  with `.update()` was refused, as designed).
- `services.export_logs(actor, file_type, filters)`: CSV/Excel through `core.exports` (formula-safe), max 50 000 rows (else
  400: narrow the dates), then records `audit.export.generated`. Viewing the log is not itself logged (it would flood the log);
  exporting is.
- `core.exports` (moved from `reports` in this step) is shared so `audit` keeps depending on `core` only.
- UI `/admin/audit`: debounced search + event/date filters in the URL, actor chip (from a member's admin page: "Activity in
  the audit log"), expandable rows showing before / after / details JSON, request id and user agent, CSV/Excel export links.
