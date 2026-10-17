---
tags: [architecture, security]
---
# Security Model

## Authentication
- **Django session authentication** (same-site SPA). Cookies: `HttpOnly`, `SameSite=Lax`,
  `Secure` in prod. Session lifetime is configurable. Sessions rotate on login.
- **CSRF:** `GET /api/v1/auth/csrf/` sets the `csrftoken` cookie. axios sends
  `X-CSRFToken` on unsafe methods. `CSRF_TRUSTED_ORIGINS` is set in prod. DRF checks CSRF only for
  authenticated sessions, so the **anonymous** state-changing endpoints (login, register, password
  reset/confirm, verify-email) call `core.authentication.enforce_csrf`. The token **rotates on
  login**, so the SPA must re-read the cookie afterwards.
- **Passwords:** Argon2 (`argon2-cffi`) as the first hasher, plus Django
  `AUTH_PASSWORD_VALIDATORS` (min length 10, common, numeric, similarity).
- **Login:** accepts email **or** username. Failures return one generic message
  ("Invalid credentials or account not active") so the response does not reveal which
  accounts exist.
- **Password reset:** Django token generator. The response is identical whether or not
  the email exists. Email backend is console in dev, SMTP in prod.
- **Registration gating** (`system.registration_mode`): `OPEN` | `APPROVAL` (default) |
  `EMAIL_VERIFICATION` | `CLOSED`.

## Authorisation
- Global DRF default: `IsAuthenticated` plus `IsActiveMember` (status `ACTIVE`).
- Admin endpoints: `IsSuperAdmin` on every view under `/api/v1/admin/`.
- Object-level scoping is done in **selectors**: `list_my_evaluations(user)` returns only
  `evaluator=user`. A lookup on another user's object returns **404**, not 403, to avoid
  confirming that it exists.
- WebSocket consumers check the session user and role on `connect` (Phase 5).

## Input & output safety
- Serializers validate every input. Comment and suggestion lengths are enforced
  server-side. Text is stripped of control characters and stored as plain text.
- React renders text only. A CSP header is set in prod (`default-src 'self'`).
- File uploads (profile photos, optional) are validated with Pillow, size-limited and
  stored outside the web root with random names.

## Abuse protection
- Client IP for throttles: DRF `NUM_PROXIES` = 0 by default (`REMOTE_ADDR`), and 1 when
  `USE_X_FORWARDED_FOR` (prod behind Nginx). A client-supplied `X-Forwarded-For` header is never trusted.
- DRF throttles (scoped):
  - `login`: 5/min per IP+identifier
  - `register`: 3/hour per IP
  - `password_reset`: 3/hour per IP
  - `evaluation_submit`: 30/hour per user
- Repeated failed logins emit `accounts.user.login_failed`. A burst triggers an
  "unusual activity" admin notification (RT-04).

## Data integrity
- `AuditLog`, `EvaluationRevision` and `ModerationAction` inherit `AppendOnlyModel`:
  `save()` on an existing row and `delete()` raise. No update/delete API exists. In
  prod, the app DB user may also have `UPDATE`/`DELETE` revoked on those tables
  (Phase 6 hardening).
- Soft delete or archival everywhere else.

## Secrets & config
- `django-environ` reads `.env` (dev) and real env vars (prod). `.env` is git-ignored.
  `.env.example` documents every key.
- Required prod settings: `DEBUG=False`, `SECRET_KEY`, `FEEDBACK_ID_KEY`,
  `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `SECURE_SSL_REDIRECT`, HSTS,
  `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`.
- `python manage.py check --deploy` must be clean before release.

## Database
- The app user has least privilege (no `DROP`/`GRANT`). A separate migration user is optional.
- MySQL strict mode, `utf8mb4`.

Related: [[Privacy Model]] · [[Roles and Permissions]] · [[Accounts]]
