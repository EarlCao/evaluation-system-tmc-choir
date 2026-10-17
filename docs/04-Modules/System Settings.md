---
tags: [module]
module: system
phase: 1 (model), 4 (UI), 6 (retention/backups)
status: model + services implemented (step 1.3); API/UI in steps 2.3 / 4.6
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
| `retention_evaluations_days` | null (keep) |
| `retention_revisions_days` | null (keep) |
| `retention_audit_days` | 730 (minimum 30) |
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
Public: `GET /api/v1/system/public/` ✅ (2.3) · Admin: `GET/PATCH /api/v1/admin/settings/` (4.6)

## Data management (Phase 6)
- `manage.py apply_retention` (scheduled): purges or anonymises per the retention fields,
  and is itself audited.
- `scripts/backup.sh` (mysqldump → compressed, encrypted, rotated) and
  `scripts/restore.sh`, with a documented restore drill.
- Account deactivation workflow (status `DEACTIVATED`, data retained) and member data
  export (their own profile + submitted evaluations + anonymised received feedback).

Related: [[Privacy Model]] · [[Accounts]]
