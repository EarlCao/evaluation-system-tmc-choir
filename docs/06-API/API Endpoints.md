---
tags: [api]
---
# API Endpoints

Status legend: 📝 planned · 🚧 in progress · ✅ implemented (update as steps complete)
Perm: **P** public · **M** active member · **A** super admin

## Core
| Method | Path | Perm | Phase | Status |
|---|---|---|---|---|
| GET | `/api/v1/health/` | P | 1 | ✅ |
| GET | `/api/schema/`, `/api/docs/` | dev: P · else: A | 1 | ✅ |

## Accounts (`apps/accounts`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/auth/csrf/` | P | – | 1 | ✅ |
| POST | `/api/v1/auth/login/` | P | AUTH-02 | 1 | ✅ |
| POST | `/api/v1/auth/logout/` | M | AUTH-02 | 1 | ✅ |
| GET | `/api/v1/auth/me/` | M | AUTH-04 | 1 | ✅ |
| PATCH | `/api/v1/auth/me/` | M | AUTH-04 | 1 | ✅ |
| POST | `/api/v1/auth/password-change/` | M | AUTH-02 | 1 | ✅ |
| POST | `/api/v1/auth/password-reset/` | P | AUTH-02 | 1 | ✅ |
| POST | `/api/v1/auth/password-reset/confirm/` | P | AUTH-02 | 1 | ✅ |
| POST | `/api/v1/auth/verify-email/` | P | AUTH-03 | 1 | ✅ |
| POST | `/api/v1/auth/deactivate/` (`{password, reason?}`) | M | AUTH-04, BR-06 | 6 | ✅ |
| GET | `/api/v1/admin/members/` (`search`, `status`, `role`, `voice_section`) — all accounts incl. Super Admins | A | ADM-04, MEM-05 | 4 | ✅ |
| GET | `/api/v1/admin/members/{public_id}/` | A | ADM-04 | 4 | ✅ |
| POST | `/api/v1/admin/members/{public_id}/approve/` | A | AUTH-03 | 4 | ✅ |
| POST | `/api/v1/admin/members/{public_id}/status/` {status, reason} | A | AUTH-05 | 4 | ✅ |
| POST | `/api/v1/admin/members/{public_id}/role/` {role} | A | ADM-04 | 4 | ✅ |
| POST | `/api/v1/admin/members/{public_id}/send-password-reset/` | A | AUTH-05 | 4 | ✅ |

## Members (`apps/members`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/members/register/` | P | AUTH-01 | 1 | ✅ |
| GET | `/api/v1/members/voice-sections/` | P | AUTH-01 | 1 | ✅ |
| GET | `/api/v1/members/` (`?search=&voice_section=&page=`) | M | MEM-01, MEM-02 | 2 | ✅ |
| GET | `/api/v1/members/{public_id}/` | M | MEM-03 | 2 | ✅ |
| GET/PATCH | `/api/v1/members/me/` (bio) | M | AUTH-04 | 2 | ✅ |
| PATCH | `/api/v1/admin/members/{public_id}/` (voice_section, is_evaluable, joined_choir_on) | A | MEM-05 | 4 | ✅ |
| GET/POST | `/api/v1/admin/voice-sections/` · PATCH `/{id}/` | A | MEM-05 | 4 | ✅ |

## Evaluations (`apps/evaluations`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/evaluation-cycles/current/` → `{cycle\|null}` | M | EVAL-06 | 2 | ✅ |
| GET | `/api/v1/evaluation-cycles/{public_id}/form/` | M | EVAL-01, EVAL-03 | 2 | ✅ |
| GET | `/api/v1/evaluations/eligibility/?recipient=` | M | MEM-04, BR-14 | 2 | ✅ |
| POST | `/api/v1/evaluations/` (30/h/user) | M | EVAL-01..08 | 2 | ✅ |
| GET | `/api/v1/evaluations/mine/` (`?cycle=`) | M | MINE-01 | 2 | ✅ |
| GET | `/api/v1/evaluations/mine/{public_id}/` (author only) | M | MINE-01 | 2 | ✅ |
| PATCH | `/api/v1/evaluations/mine/{public_id}/` (within edit window) | M | MINE-02 | 3 | ✅ |
| GET | `/api/v1/evaluations/mine/{public_id}/revisions/` (author only; no editor field) | M | MINE-04 | 3 | ✅ |
| GET/POST | `/api/v1/admin/criterion-categories/` · PATCH `/{id}/` | A | CFG-01 | 2 | ✅ |
| GET/POST | `/api/v1/admin/criteria/` (`?include_archived=true`) | A | EVAL-02, CFG-01..03 | 2 | ✅ |
| GET/PATCH | `/api/v1/admin/criteria/{public_id}/` (wording/scale change → new version) | A | EVAL-02, BR-07 | 2 | ✅ |
| POST | `/api/v1/admin/criteria/{public_id}/archive/` · GET `/versions/` · POST `/api/v1/admin/criteria/reorder/` | A | EVAL-02 | 2 | ✅ |
| GET/POST | `/api/v1/admin/form-versions/` (paginated) · GET/PATCH `/{public_id}/` (draft only) | A | CFG-04, CFG-06 | 2 | ✅ |
| POST | `/api/v1/admin/form-versions/{public_id}/publish/` | A | CFG-06, BR-18 | 2 | ✅ |
| GET/POST | `/api/v1/admin/evaluation-cycles/` (paginated) · GET/PATCH `/{public_id}/` | A | CFG-05, EVAL-06 | 2 | ✅ |
| POST | `/api/v1/admin/evaluation-cycles/{public_id}/open/` · `/close/` · `/archive/` | A | EVAL-06 | 2 | ✅ |
| GET | `/api/v1/admin/evaluations/` | A | ADM-02, ADM-03 | 4 | ✅ |
| GET | `/api/v1/admin/evaluations/{public_id}/` | A | ADM-02 | 4 | ✅ |
| GET | `/api/v1/admin/evaluations/{public_id}/revisions/` | A | ADM-02 | 4 | ✅ |
| POST | `/api/v1/admin/evaluations/{public_id}/moderate/` | A | ADM-05 | 4 | ✅ |
| GET | `/api/v1/admin/moderation-queue/` | A | ADM-05 | 4 | ✅ |

## Feedback (`apps/feedback`): member-facing, anonymised
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/feedback/received/` (`cycle`, `date_from`, `date_to`) | M | FB-01, FB-04 | 3 | ✅ |
| GET | `/api/v1/feedback/received/summary/` (`cycle`, `criterion`) | M | FB-03, REP-02 | 3 | ✅ |
| GET | `/api/v1/feedback/received/count/` | M | FB-03 | 3 | ✅ |

## Reports (`apps/reports`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/` | M | – | 2 | ✅ (grows in 2.3 / 3.2) |
| GET | `/api/v1/me/export/` (own account, profile, evaluations given, anonymised feedback received; audited as `accounts.data_export.generated`) | M | AUTH-04 | 6 | ✅ |
| GET | `/api/v1/admin/reports/dashboard/` (members, evaluations, cycles, participation) | A | ADM-01 | 4 | ✅ |
| GET | `/api/v1/admin/reports/members/{public_id}/` | A | REP-01 | 4 | ✅ |
| GET | `/api/v1/admin/reports/choir/` | A | REP-01 | 4 | ✅ |
| GET | `/api/v1/admin/reports/participation/` | A | REP-01 | 4 | ✅ |
| GET | `/api/v1/admin/reports/export/` | A | ADM-07 | 4 | ✅ |

Export query: `report` = `choir` | `member` (+ `member`) | `participation` (+ `cycle`) | `evaluations` (browser filters); `file_type` = `csv` | `xlsx` | `pdf` (no PDF for `evaluations`). Not `format`: DRF reserves it for content negotiation. Throttled 60/hour per Super Admin; each export audited as `reports.export.generated`.

## Audit (`apps/audit`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/audit-logs/` (filters: search, event_type (exact or `prefix.`), actor, target_type, target_id, occurred_from/to) | A | AUD-04 | 4 | ✅ |
| GET | `/api/v1/admin/audit-logs/event-types/` | A | AUD-04 | 4 | ✅ |
| GET | `/api/v1/admin/audit-logs/{id}/` (read-only: PUT/PATCH/DELETE → 405) | A | AUD-03, AUD-04 | 4 | ✅ |
| GET | `/api/v1/admin/audit-logs/export/?file_type=csv\|xlsx` (+ filters; max 50 000 rows; audited as `audit.export.generated`) | A | AUD-04 | 4 | ✅ |

## System (`apps/system`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/system/public/` | P | SET-03 | 2 | ✅ |
| GET/PATCH | `/api/v1/admin/settings/` (PATCH partial; audited as `system.settings.changed`) | A | SET-01, SET-03 | 4 | ✅ |

## Notifications (`apps/notifications`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/notifications/` (`?unread=true`; own only, newest first, paginated) | M | RT-02 | 5 | ✅ |
| GET | `/api/v1/notifications/unread-count/` | M | RT-05 | 5 | ✅ |
| POST | `/api/v1/notifications/{id}/read/` | M | – | 5 | ✅ |
| POST | `/api/v1/notifications/read-all/` | M | – | 5 | ✅ |
| WS | `/ws/notifications/` (unread_count, notification.created; close 4401/4001) | M | RT-01 | 5 | ✅ |
| WS | `/ws/admin/` | A | RT-01, RT-04 | 5 | ✅ |

Related: [[API Conventions]] · [[Pages and Routes]]
