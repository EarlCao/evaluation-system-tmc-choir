---
tags: [module]
module: accounts
phase: 1
status: implemented (step 1.4); admin API/UI in step 4.2
---
# Module: Accounts

**Backend:** `apps/accounts` · **Frontend:** `features/auth`
**Requirements:** AUTH-01..06 ([[Functional Requirements]])

## Responsibility
Identity, credentials, roles, account status, registration, login/logout, password reset,
and the user's own profile basics.

## Models
**`User`** (custom, `AUTH_USER_MODEL = "accounts.User"`, created **before the first
migration**). Extends `AbstractBaseUser` + `PermissionsMixin` + `PublicIdModel`.

| Field | Notes |
|---|---|
| `email` | unique, required, normalised to lowercase |
| `username` | unique, required |
| `first_name`, `last_name` | required |
| `display_name` | optional |
| `role` | `MEMBER` (default) \| `SUPER_ADMIN` |
| `status` | `PENDING` \| `ACTIVE` \| `SUSPENDED` \| `DEACTIVATED` |
| `email_verified_at` | nullable |
| `approved_by`, `approved_at` | nullable |
| `is_staff` | Django admin access only; true only for super admins |
| `date_joined`, `last_login`, `updated_at` | |

Login identifier is email or username. The voice section lives in [[Members]]
(`MemberProfile`). The **registration use-case** is `members.services.register_member`,
which calls `accounts.services.create_user` inside one transaction. `accounts` never
imports `members`.

## Services
- `create_user(*, email, username, password, first_name, last_name)`: sets status from
  `system.registration_mode` (`APPROVAL` → `PENDING`, `OPEN` → `ACTIVE`). Publishes
  `accounts.user.registered`. Called by `members.services.register_member`.
- `authenticate_and_login(*, request, identifier, password)`: checks status, rotates the
  session, publishes `logged_in` or `login_failed`.
- `logout(*, request)`
- `request_password_reset(*, email)` / `confirm_password_reset(*, uid, token, new_password)`
- `change_password(*, user, old_password, new_password)`
- `update_own_profile(*, user, **permitted_fields)`
- `set_user_status(*, actor, user, status, reason)` (Super Admin, Phase 4)
- `set_user_role(*, actor, user, role)` (Super Admin, Phase 4). The last remaining super
  admin cannot be demoted.
- `create_super_admin` management command: `python manage.py create_super_admin`

## Selectors
- `get_user_by_public_id(public_id)` · `list_users(filters)` (admin) · `count_users_by_status()`

## API
See [[API Endpoints]] §Accounts. Includes `csrf`, `login`, `logout`, `me`,
`password-reset`, `password-reset/confirm`, `password-change`, and admin `users`.

## Events published
`accounts.user.registered`, `.logged_in`, `.login_failed`, `.status_changed`,
`.role_changed`, `accounts.password.reset_requested`

## Frontend (`features/auth`)
Pages: Welcome, Login, Register, Forgot Password, Reset Password, Profile.
Hooks: `useCurrentUser()` (`GET /auth/me/`), `useLogin`, `useLogout`, `useRegister`.
Guards: `RequireAuth`, `RequireSuperAdmin`, `GuestOnly`.

## Tests
Registration per `registration_mode`; pending users cannot log in; generic login error;
throttling; password reset does not reveal whether an email exists; members cannot reach
admin user endpoints; the last super admin cannot be demoted.

Related: [[Security Model]] · [[Roles and Permissions]] · [[System Settings]]

## Implementation notes (step 1.4)
- `USERNAME_FIELD = "username"`. Login goes through `backends.EmailOrUsernameBackend`
  (username **or** email, case-insensitive). It runs the hasher for unknown identifiers so
  timing doesn't reveal which accounts exist.
- `User.is_active` is a **property derived from `status`**. Django's session machinery
  therefore drops a suspended or deactivated user's existing sessions on their next request.
- `is_active_member` / `is_super_admin` properties feed `core.permissions`.
- Tokens (`tokens.py`): password reset uses Django's generator. Email verification uses its
  own salt and hashes status + `email_verified_at`, so each link works once. Links are valid for 2h (`PASSWORD_RESET_TIMEOUT`).
- Every login failure raises `InvalidCredentials` (400 `invalid_credentials`, *"Invalid credentials or account not active."*).
- Anonymous state-changing views (`login`, `password-reset`, `password-reset/confirm`,
  `verify-email`) enforce CSRF explicitly via `core.authentication.enforce_csrf` (prevents login CSRF).
- Throttles: `LoginThrottle` (5/min per IP + identifier hash), `PasswordResetThrottle` (3/h per IP;
  also used for confirm and verify-email).
- Events: `user.registered`, `user.super_admin_created`, `user.logged_in`, `user.logged_out`,
  `user.login_failed` (`identifier_hash` = HMAC, never the raw input), `password.changed`,
  `password.reset_requested`, `password.reset_completed`, `user.email_verified`,
  `user.profile_updated` (`changed_fields` only), `user.status_changed` (`changes`, `reason`).
- Services implemented early for the emergency Django admin: `approve_user`, `set_user_status`
  (cannot change your own status; the last active Super Admin cannot be deactivated).
  `set_user_role` comes in step 4.2.
- Django admin: users are read-only. Actions *approve / suspend / reactivate* call the services, so they are audited.
- `manage.py create_super_admin --email … --username … --first-name … --last-name …`
  reads the password from `SUPER_ADMIN_PASSWORD` or prompts for it.
- Factories: `apps/accounts/tests/factories.py` → `UserFactory` (traits `pending`, `suspended`, `deactivated`), `SuperAdminFactory`.

## Implementation notes (step 4.2)
- `set_user_role(actor, user, role)`: you can't change your own role; the last active Super Admin can't be demoted; `is_staff`/`is_superuser` follow the role; publishes `accounts.user.role_changed` (before/after).
- `send_password_reset(actor, user)`: ACTIVE only; reuses the normal reset email.
- Q9: `evaluations.rules.eligibility` refuses Super Admins even if they have a choir profile (NOT_A_MEMBER); they also don't count as possible evaluators in participation.

## Implementation notes (step 6.4): self-deactivation
- `deactivate_own_account(*, request, user, password, reason="")`: verifies `user.check_password(password)`, refuses to deactivate the last active Super Admin, sets `status = DEACTIVATED`, publishes `accounts.user.status_changed`, and logs the session out. Historical evaluations remain intact (`BR-06`).
- API: `POST /api/v1/auth/deactivate/` (`accounts:deactivate`), exposed on `/app/profile` alongside the member own-data download (`GET /api/v1/me/export/`).

