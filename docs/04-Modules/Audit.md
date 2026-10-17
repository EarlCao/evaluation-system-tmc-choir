---
tags: [module, security]
module: audit
phase: 1 (model + handlers), 4 (viewer UI)
status: model + record + event handler implemented (step 1.3); viewer API/UI in step 4.6
---
# Module: Audit

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
`GET /api/v1/admin/audit-logs/export/`. **No POST/PUT/PATCH/DELETE.**

## Tests
Implemented (step 1.3): append-only (instance and queryset update/delete raise; a referenced actor
cannot be deleted); `record` fields, actor resolution, role snapshot, request context and
redaction; the handler writes a row only after commit, skips rollbacks and `audited=False`;
settings changes are audited end-to-end.
Later: members get 403 on the viewer API (4.6); the export itself is logged.

Related: [[Security Model]] · [[Module Boundaries]]
