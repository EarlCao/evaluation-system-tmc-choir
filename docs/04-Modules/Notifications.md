---
tags: [module, realtime]
module: notifications
phase: 5
status: planned
---
# Module: Notifications

**Backend:** `apps/notifications` · **Frontend:** `features/notifications`
**Requirements:** RT-01..06

## Responsibility
In-app notifications plus real-time delivery over WebSockets (Channels/Redis). It is an
**event consumer**: no other module imports it. See [[Realtime Architecture]].

## Model
**`Notification`**: `recipient` (FK User), `type`, `message` (safe text), `link`
(relative SPA path), `is_read`, `read_at`, `created_at`. Index on `(recipient, is_read, created_at)`.

Types: `FEEDBACK_AVAILABLE`, `CYCLE_OPENED`, `CYCLE_CLOSED`, `OWN_EVALUATION_EDITED`,
`ACCOUNT_APPROVED`, admin-only `REGISTRATION_PENDING`, `UNUSUAL_ACTIVITY`, `CYCLE_COMPLETED`.

## Handlers (event → notification)
| Event | Notification | To |
|---|---|---|
| `evaluations.evaluation.submitted` | "You have new feedback." (debounced 60 min; delayed until close if AFTER_CLOSE) | recipient |
| `evaluations.evaluation.edited` | "Your evaluation for <recipient> was updated." | **author** only |
| `evaluations.cycle.opened` / `.closed` | "Evaluation period '<name>' is open/closed." | all active members |
| `accounts.user.registered` (PENDING) | "New registration awaiting approval." | super admins |
| `accounts.user.login_failed` burst | "Unusual login activity detected." | super admins |
| `accounts.user.status_changed` → ACTIVE | "Your account has been approved." | user |

> [!danger] RT-06
> Member notifications never contain evaluator names, IDs or exact submission times.
> There is a test for each handler.

## API & WS
REST: `GET /api/v1/notifications/`, `GET /api/v1/notifications/unread-count/`,
`POST /api/v1/notifications/{id}/read/`, `POST /api/v1/notifications/read-all/`.
WS: `/ws/notifications/`, `/ws/admin/`.

## Channels
In-app + WS in v1. Email only for password reset and verification (proposed default for
Q7, [[Open Questions]]).

## Frontend
Bell icon with an unread badge in the layout, a notification center page, and the
`lib/ws.ts` subscription with reconnect and polling fallback.

Related: [[Realtime Architecture]] · [[Privacy Model]]
