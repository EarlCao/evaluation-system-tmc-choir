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
| GET | `/api/v1/admin/users/` | A | ADM-04 | 4 | 📝 |
| GET | `/api/v1/admin/users/{public_id}/` | A | ADM-04 | 4 | 📝 |
| POST | `/api/v1/admin/users/{public_id}/status/` | A | AUTH-05 | 4 | 📝 |
| POST | `/api/v1/admin/users/{public_id}/role/` | A | ADM-04 | 4 | 📝 |
| POST | `/api/v1/admin/users/{public_id}/approve/` | A | AUTH-03 | 4 | 📝 |

## Members (`apps/members`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/members/register/` | P | AUTH-01 | 1 | ✅ |
| GET | `/api/v1/members/voice-sections/` | P | AUTH-01 | 1 | ✅ |
| GET | `/api/v1/members/` (`?search=&voice_section=&page=`) | M | MEM-01, MEM-02 | 2 | ✅ |
| GET | `/api/v1/members/{public_id}/` | M | MEM-03 | 2 | ✅ |
| GET/PATCH | `/api/v1/members/me/` (bio) | M | AUTH-04 | 2 | ✅ |
| PATCH | `/api/v1/admin/members/{public_id}/` | A | MEM-05 | 4 | 📝 |
| CRUD | `/api/v1/admin/voice-sections/` | A | MEM-05 | 4 | 📝 |

## Evaluations (`apps/evaluations`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/evaluation-cycles/current/` | M | EVAL-06 | 2 | 📝 |
| GET | `/api/v1/evaluation-cycles/{public_id}/form/` | M | EVAL-01, EVAL-03 | 2 | 📝 |
| GET | `/api/v1/evaluations/eligibility/?recipient=` | M | MEM-04, BR-14 | 2 | 📝 |
| POST | `/api/v1/evaluations/` | M | EVAL-01..08 | 2 | 📝 |
| GET | `/api/v1/evaluations/mine/` | M | MINE-01 | 2 | 📝 |
| GET | `/api/v1/evaluations/mine/{public_id}/` | M | MINE-01 | 2 | 📝 |
| PATCH | `/api/v1/evaluations/mine/{public_id}/` | M | MINE-02 | 3 | 📝 |
| GET | `/api/v1/evaluations/mine/{public_id}/revisions/` | M | MINE-04 | 3 | 📝 |
| GET/POST | `/api/v1/admin/criterion-categories/` · PATCH `/{id}/` | A | CFG-01 | 2 | ✅ |
| GET/POST | `/api/v1/admin/criteria/` (`?include_archived=true`) | A | EVAL-02, CFG-01..03 | 2 | ✅ |
| GET/PATCH | `/api/v1/admin/criteria/{public_id}/` (wording/scale change → new version) | A | EVAL-02, BR-07 | 2 | ✅ |
| POST | `/api/v1/admin/criteria/{public_id}/archive/` · GET `/versions/` · POST `/api/v1/admin/criteria/reorder/` | A | EVAL-02 | 2 | ✅ |
| GET/POST | `/api/v1/admin/form-versions/` (paginated) · GET/PATCH `/{public_id}/` (draft only) | A | CFG-04, CFG-06 | 2 | ✅ |
| POST | `/api/v1/admin/form-versions/{public_id}/publish/` | A | CFG-06, BR-18 | 2 | ✅ |
| GET/POST | `/api/v1/admin/evaluation-cycles/` (paginated) · GET/PATCH `/{public_id}/` | A | CFG-05, EVAL-06 | 2 | ✅ |
| POST | `/api/v1/admin/evaluation-cycles/{public_id}/open/` · `/close/` · `/archive/` | A | EVAL-06 | 2 | ✅ |
| GET | `/api/v1/admin/evaluations/` | A | ADM-02, ADM-03 | 4 | 📝 |
| GET | `/api/v1/admin/evaluations/{public_id}/` | A | ADM-02 | 4 | 📝 |
| GET | `/api/v1/admin/evaluations/{public_id}/revisions/` | A | ADM-02 | 4 | 📝 |
| POST | `/api/v1/admin/evaluations/{public_id}/moderate/` | A | ADM-05 | 4 | 📝 |
| GET | `/api/v1/admin/moderation-queue/` | A | ADM-05 | 4 | 📝 |

## Feedback (`apps/feedback`): member-facing, anonymised
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/feedback/received/` | M | FB-01, FB-04 | 3 | 📝 |
| GET | `/api/v1/feedback/received/summary/` | M | FB-03, REP-02 | 3 | 📝 |
| GET | `/api/v1/feedback/received/count/` | M | FB-03 | 3 | 📝 |

## Reports (`apps/reports`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/` | M | – | 2 | ✅ (grows in 2.3 / 3.2) |
| GET | `/api/v1/admin/reports/dashboard/` | A | ADM-01 | 4 | 📝 |
| GET | `/api/v1/admin/reports/members/{public_id}/` | A | REP-01 | 4 | 📝 |
| GET | `/api/v1/admin/reports/choir/` | A | REP-01 | 4 | 📝 |
| GET | `/api/v1/admin/reports/participation/` | A | REP-01 | 4 | 📝 |
| GET | `/api/v1/admin/reports/export/` | A | ADM-07 | 4 | 📝 |

## Audit (`apps/audit`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/audit-logs/` | A | AUD-04 | 4 | 📝 |
| GET | `/api/v1/admin/audit-logs/{id}/` | A | AUD-04 | 4 | 📝 |
| GET | `/api/v1/admin/audit-logs/export/` | A | AUD-04 | 4 | 📝 |

## System (`apps/system`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/system/public/` | P | SET-03 | 2 | 📝 |
| GET/PATCH | `/api/v1/admin/settings/` | A | SET-01 | 4 | 📝 |

## Notifications (`apps/notifications`)
| Method | Path | Perm | Req | Phase | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/notifications/` | M | RT-02 | 5 | 📝 |
| GET | `/api/v1/notifications/unread-count/` | M | RT-05 | 5 | 📝 |
| POST | `/api/v1/notifications/{id}/read/` | M | – | 5 | 📝 |
| POST | `/api/v1/notifications/read-all/` | M | – | 5 | 📝 |
| WS | `/ws/notifications/` | M | RT-01 | 5 | 📝 |
| WS | `/ws/admin/` | A | RT-01, RT-04 | 5 | 📝 |

Related: [[API Conventions]] · [[Pages and Routes]]
