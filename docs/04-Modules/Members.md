---
tags: [module]
module: members
phase: 2
status: registration (1.4) + directory, detail, own profile (2.1) implemented; admin management in step 4.2
---
# Module: Members

Deployment review (2026-10-21): evaluations registers directory/self-review readers
at startup; members no longer imports evaluation models or serializers. Progress
fields describe only the viewer's own submissions. Registration retries preserve
existing accounts. Registration email/server failures release only their own hourly
throttle reservation; rapid attempts remain limited to ten per minute. Successful
registrations and validation failures retain the three-per-hour limit. The corrected
policy uses new hourly counters, so old delivery-failure lockouts do not carry over.
See [[Deployment Readiness 2026-10-20]] and [[Security Model]].

**Backend:** `apps/members` · **Frontend:** `features/members`
**Requirements:** MEM-01..05, AUTH-04

## Responsibility
Choir-specific member profile data and the **member directory**.

## Models
**`VoiceSection`**: `name` (Soprano, Alto, Tenor, Bass, …), `sort_order`, `is_active`.
Seeded with a data migration and editable by the Super Admin.

**`MemberProfile`** (1:1 `accounts.User`)
| Field | Notes |
|---|---|
| `user` | OneToOne, PK |
| `voice_section` | FK `VoiceSection` |
| `joined_choir_on` | date, optional |
| `bio` | short text, optional |
| `photo` | optional (Pillow added only if enabled) |
| `is_evaluable` | default true. Admin can exclude someone (e.g. conductor) from being evaluated |

## Services
- `register_member(*, email, username, password, first_name, last_name, voice_section_id)`:
  the **registration use-case**. In one `transaction.atomic()` it calls
  `accounts.services.create_user(...)` and then creates the `MemberProfile`. It lives here
  because `members` depends on `accounts`, never the reverse (AUTH-01).
- `update_profile(*, user, **fields)` (self, permitted fields)
- `admin_update_member(*, actor, user, **fields)` (Phase 4)

## Selectors
- `list_directory(*, viewer, search, voice_section, status)` returns members only
  `ACTIVE` users and basic fields. Admins see every status.
- `get_member_profile(*, viewer, public_id)`

## API
`POST /api/v1/members/register/` (public, throttled), `GET /api/v1/members/` (search,
filter, paginate), `GET /api/v1/members/{public_id}/`, `GET /api/v1/members/voice-sections/`
(public, needed by the register form). Admin: `PATCH /api/v1/admin/members/{public_id}/`.

> [!note] Dependency direction (ADR-004)
> `members` must not import `evaluations`. Whether the viewer can evaluate a member
> comes from `GET /api/v1/evaluations/eligibility/?recipient=<public_id>`, and the
> frontend combines the two responses.

## Frontend (`features/members`)
Directory page (search box, voice-section filter, table/cards, responsive). Member
profile page with an "Evaluate" button, enabled from the eligibility endpoint. Self
profile shows "You cannot evaluate yourself".

## Tests
Directory hides inactive users from members; search/filter; pagination; profile of a
suspended member returns 404 for members; no email shown to other members (only the
name and voice section are basic fields).

Related: [[Accounts]] · [[Evaluations]]

## Implementation notes (step 1.4)
- `VoiceSection` is seeded by migration `0002_seed_voice_sections` (Soprano, Alto, Tenor, Bass).
  Deactivate a section instead of deleting it (profiles PROTECT it).
- `MemberProfile.user` is the primary key (OneToOne, CASCADE). `bio` max 500 characters.
- `register_member` validates the voice section (must be active), then creates the User
  (via `accounts.services.create_user`) and the profile in **one transaction**. A failure rolls back both.
- `POST /api/v1/members/register/`: CSRF enforced, `RegisterThrottle` 3/h per IP. Answers `201 {status, detail}`
  with a mode-specific next step. A CLOSED registration returns 409.
- `GET /api/v1/members/voice-sections/` is public and unpaginated.
- Factory: `MemberProfileFactory` (creates an ACTIVE user). Helper `voice_section(name)`.

## Implementation notes (step 2.1)
- `filters.DirectoryFilter` (django-filter): `search` (every word must match first, last or display name),
  `voice_section` (active sections only; an invalid id → 400 `fields.voice_section`).
- `selectors.list_directory(params)` covers ACTIVE accounts with a profile only (super admins have none), ordered by
  last and first name, with `select_related("user", "voice_section")`. A test caps the queries (no N+1).
- `selectors.get_member_profile(public_id)`: inactive or unknown members → `NotFound` (404).
- `services.update_own_profile(user, bio)` (≤ 500 characters) publishes `members.profile.updated` (audited).
- API: `GET /members/` (DirectoryEntry: public_id, first/last/display name, voice_section; **no email,
  username or status**), `GET /members/{public_id}/` (+ bio, joined_choir_on, is_self), `GET/PATCH /members/me/` (bio).
- Frontend `features/members`: `MemberDirectoryPage` (debounced search, section filter and pagination, all in the URL;
  skeleton, empty and error states; list labelled "Members"), `MemberProfilePage` (read-only for others, bio editor for self, 404 page).

## Implementation notes (step 4.2): Super Admin member management
- Admin API lives in **members** (`api/admin_urls.py`, namespace `members-admin`) because a "member" combines the account (accounts)
  and the profile (members), and members may depend on accounts but not the reverse. The read model `admin_list_members` / `admin_get_member`
  queries `User` + `member_profile` read-only. Every **write** goes through the owning service (`accounts.services.*` or `members.services.*`), so it's audited.
- Endpoints: `GET /admin/members/` (`search` over name/username/email, `status`, `role`, `voice_section`; validated, paginated),
  `GET/PATCH /admin/members/{id}/` (voice_section, is_evaluable, joined_choir_on → `members.profile.updated` with changes),
  `POST …/approve/`, `…/status/` {status, reason}, `…/role/` {role}, `…/send-password-reset/` (ACTIVE only, AUTH-05 "reset access"),
  `GET/POST /admin/voice-sections/`, `PATCH /admin/voice-sections/{id}/` (name, sort_order, is_active; `members.voice_section.changed`).
- Frontend: `/admin/members` (table, search, status/role filters in the URL), `/admin/members/:id` (account actions behind `ConfirmDialog`,
  status reason recorded in the audit log, role change explained, password-reset email, profile form), `/admin/voice-sections`
  (rename, offer at registration on/off, add). The dashboard's "Waiting for approval" tile links to the pending filter.
