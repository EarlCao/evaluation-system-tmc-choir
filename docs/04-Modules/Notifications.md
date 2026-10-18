---
tags: [module, realtime]
module: notifications
phase: 5
status: model + services + REST (5.1), handlers + consumers + delivery (5.2) implemented; UI 5.3
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

## Implementation notes (step 5.2): handlers, delivery, consumers
| Event | Result |
|---|---|
| `evaluations.evaluation.submitted` | `queue_feedback_notice` (debounced or held for AFTER_CLOSE) + admin `dashboard.changed` |
| `evaluations.cycle.opened` | CYCLE_OPENED to active **members** ("Evaluation period “X” is open.", `/app/members`) |
| `evaluations.cycle.closed` | CYCLE_CLOSED to members, CYCLE_COMPLETED to Super Admins (participation report link); releases + delivers AFTER_CLOSE notices |
| `accounts.user.registered` (PENDING) | REGISTRATION_PENDING to Super Admins (no name in the text) |
| `accounts.user.status_changed` | PENDING→ACTIVE: ACCOUNT_APPROVED to the user; → not ACTIVE: `session.revoked` (sockets closed, code 4001) |
| `accounts.user.login_failed` | 10 failures for one hashed identifier in 15 min → one UNUSUAL_ACTIVITY to Super Admins |
| `evaluations.evaluation.edited` | **nothing**: only the author can edit, so "your evaluation was edited" would echo their own action (OWN_EVALUATION_EDITED kept for a future admin-edit feature) |

- Delivery (ADR-020): `services.deliver_due(now, recipient_id)` from `manage.py deliver_notifications [--loop N]` (compose
  `worker`) and lazily in `GET /notifications/` and `/unread-count/`.
- `realtime.py`: `user.<public_id>` and `admins` groups; envelope `{type, payload, sent_at}`; pushes after commit, failures
  logged only. `dashboard.changed` is throttled to one per 5 s and carries no data (the admin page refetches over REST).
- Consumers: `/ws/notifications/` (ACTIVE users; sends `unread_count` on connect, then `notification.created` with the
  user's own notification + unread count; answers `ping` with `pong`), `/ws/admin/` (Super Admins; `dashboard.changed`).
  Close codes 4401 not signed in/not active, 4403 not a Super Admin, 4001 revoked. Origin checked against `ALLOWED_HOSTS`.
- Tests: handler privacy (no evaluator name/username/public id in the notification or its push), timing (nothing at submit,
  delivered after the window), AFTER_CLOSE hold/release, fan-out excludes suspended users, consumers through the real ASGI
  stack with a session cookie (anonymous 4401, foreign origin refused, live push, admin-only socket, suspension disconnects).
