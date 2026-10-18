---
tags: [module]
module: system
phase: 1 (model), 4 (UI), 6 (retention/backups)
status: implemented (1.3, 2.3, 4.6, 6.4)
---
# Module: System Settings

**Backend:** `apps/system` · **Frontend:** `features/admin` (settings), `/privacy` page
**Requirements:** SET-01..06

## Responsibility
System-wide configuration, the privacy notice, and retention policy. Other modules read
settings through `system.selectors.get_settings()` (cached, invalidated on change).

## Model
**`SystemSettings`** (singleton row, pk=1)
| Field | Default |
|---|---|
| `system_name` | "Choir Member Evaluation System" |
| `choir_name`, `choir_description` | "" |
| `time_zone` | `UTC` until confirmed (see [[Open Questions]] Q8) |
| `registration_mode` | `APPROVAL` (`OPEN` / `APPROVAL` / `EMAIL_VERIFICATION` / `CLOSED`) |
| `min_aggregate_group_size` | 3 (**minimum 3**, privacy floor, ADR-013) |
| `feedback_notification_debounce_minutes` | 60 |
| `privacy_notice` | default text from [[Privacy Model]] (plain text / limited markdown rendered safely) |
| `evaluation_retention_days` | null (keep) |
| `audit_log_retention_days` | null (keep; when set, minimum 30) |
| `updated_by`, `updated_at` | |

Notification preferences per user (`NotificationPreference`) arrive in Phase 5 if needed.

Singleton rules: the row (pk=1) is seeded by migration `0002_create_singleton`.
`SystemSettings.load()` returns it (and recreates it if missing). Creating a second
instance raises, and so does `delete()`.

## Services / selectors (implemented)
- `selectors.get_settings()`: cached for 60s (key `system:settings:v1`). The cache is
  per-process until Redis caching arrives in step 5.1, so other workers may be up to 60s stale.
- `selectors.get_public_settings()` → `system_name`, `choir_name`, `choir_description`,
  `privacy_notice`, `registration_mode` (nothing else is public).
- `services.update_settings(*, actor, **changes)`:
  - only fields in `EDITABLE_FIELDS` are accepted
  - raw values are coerced to field types, then `full_clean()` runs; failures raise `ValidationError(fields=...)`
  - the row is locked with `select_for_update`; no-op changes publish nothing
  - the cache is invalidated **on commit**
  - publishes `SettingsChanged(actor_id, target_id=1, changes=((field, before, after), ...))`, which audit records with before/after
- Django admin (emergency only) saves through `update_settings`, so those changes are audited too.
- Constants: `RegistrationMode`, `MIN_AGGREGATE_GROUP_SIZE_FLOOR`, `DEFAULT_PRIVACY_NOTICE`.

## API
Public: `GET /api/v1/system/public/` ✅ (2.3) · Admin: `GET/PATCH /api/v1/admin/settings/` ✅ (4.6)

## Data management (Phase 6, step 6.4)
- `manage.py apply_retention` (`evaluations.services.apply_retention` + `audit.services.purge_expired_logs`, scheduled in `worker`):
  purges evaluations in `CLOSED`/`ARCHIVED` cycles older than `evaluation_retention_days` (never touches `OPEN` cycles) and audit
  logs older than `audit_log_retention_days`, recording `system.retention.applied`.
- `scripts/backup.sh` (`mysqldump --single-transaction --routines --triggers --events --set-gtid-purged=OFF` → compressed `.sql.gz` +
  `.sha256` with `chmod 600` and old-backup rotation) and `scripts/restore.sh` (verifies SHA-256, takes a safety snapshot unless
  `--no-pre-backup`, restores the dump, and runs `manage.py migrate --check`).
- Account self-deactivation (`POST /api/v1/auth/deactivate/`, status `DEACTIVATED`, evaluations retained per `BR-06`) and member
  own-data export (`GET /api/v1/me/export/`, own profile + submitted evaluations + anonymised received feedback).

Related: [[Privacy Model]] · [[Accounts]]

## Implementation notes (step 4.6): settings UI & privacy page
- `GET/PATCH /api/v1/admin/settings/` (namespace `system-admin`): GET reads the row fresh (not the 60 s cache); PATCH validates
  shape/ranges (`SettingsUpdateSerializer`: privacy floor ≥ 3, debounce 0–1440, audit retention ≥ 30 or empty) and calls
  `services.update_settings` (model `full_clean` is authoritative, e.g. unknown time zones). Unchanged values write nothing.
  Response includes `updated_at` and `updated_by`.
- UI `/admin/settings`: groups General / Registration and privacy / Notifications / Data retention; client checks mirror the
  server; only changed fields are sent; time zone picker from `Intl.supportedValuesOf("timeZone")`; saving invalidates the
  public settings query so the new privacy notice shows everywhere at once. Retention values are stored now and applied in 6.4.
- Public `/privacy` page (`features/auth`): the choir's notice plus a fixed "who sees what" table describing what the software
  guarantees; `components/SiteFooter` links to it from the member and admin layouts (removed from the public sign-in pages on request, 2026-10-18).

