---
tags: [module, realtime]
module: notifications
phase: 5
status: model + services + REST (5.1) implemented; handlers + consumers 5.2; UI 5.3
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

## Implementation notes (step 5.1): foundation
- Settings: `daphne` (first) and `channels` in `INSTALLED_APPS`; `CHANNEL_LAYERS` = `RedisChannelLayer` on `REDIS_URL`
  (tests: `InMemoryChannelLayer`). `config/asgi.py`: `ProtocolTypeRouter` with `http` → Django and `websocket` →
  `AllowedHostsOriginValidator(AuthMiddlewareStack(URLRouter(config.routing.websocket_urlpatterns)))`; this module's
  `routing.websocket_urlpatterns` is empty until 5.2.
- `Notification` (`PublicIdModel`): recipient, type (`NotificationType`), message ≤ 200, link ≤ 200 (relative SPA path; absolute
  and `//host` links refused), is_read, read_at, created_at; index (recipient, is_read, -created_at).
- `services.notify(recipient, type, message, link)`, `mark_read(user, public_id)` (another user's → 404), `mark_all_read(user)`;
  `selectors.list_for(user, unread_only)`, `unread_count(user)`, `get_own(user, public_id)`.
- REST (`IsActiveMember`; Super Admins included): list, unread-count, `{id}/read/`, `read-all/`. Registered in the privacy
  sweep (list + count swept, read/read-all as write-only).
