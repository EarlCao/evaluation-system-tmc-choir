---
tags: [module]
module: members
phase: 2
status: registration + voice sections implemented (step 1.4); directory in step 2.1
---
# Module: Members

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
