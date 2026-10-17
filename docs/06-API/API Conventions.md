---
tags: [api]
---
# API Conventions

## Base
- Prefix `/api/v1/`. Super-admin endpoints live under `/api/v1/admin/`.
- JSON only. Field names are `snake_case`.
- Resources are identified by `public_id` (UUID). Feedback items use an opaque `feedback_id`.
- OpenAPI schema from **drf-spectacular** at `/api/schema/`, with Swagger UI at `/api/docs/`
  (dev, or super admin only in prod).

## Auth
Session cookie + CSRF. The SPA calls `GET /api/v1/auth/csrf/` once on boot and axios sends
`X-CSRFToken`. Unauthenticated requests return `401`. Authenticated users without
permission get `403`. Objects outside the caller's scope return `404`.

## Pagination
```json
{ "count": 125, "next": "…?page=3", "previous": "…?page=1", "results": [ … ] }
```
`?page=`, `?page_size=` (max 100). Lists are never unpaginated.

## Filtering, search, ordering
`django-filter` query params (`?cycle=<public_id>&voice_section=2`), `?search=` for text,
and `?ordering=field,-other` where an allow-list exists.

## Error envelope
```json
{ "error": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": { "comment": ["This field is required."] }
} }
```
Codes: `validation_error` (400), `invalid_credentials` (400, login only, one generic message),
`not_authenticated` (401), `permission_denied` (403, also CSRF failures),
`not_found` (404), `method_not_allowed` (405), `business_rule_violation` (**409**, ADR-012),
`throttled` (429, with a `Retry-After` header), `server_error` (500, generic message, no details).
Django `Http404` / `PermissionDenied` are converted with **generic** messages, so model names never leak.
Messages never reveal other members' activity or identities.

## Numbers
Decimals (scale bounds, steps, ratings) are JSON **numbers** (`COERCE_DECIMAL_TO_STRING = False`).

## Dates & times
Stored in UTC and returned as ISO 8601 with `Z`. **Exception:** member-facing feedback
returns `date` (`YYYY-MM-DD`) only. See [[Privacy Model]].

## Versioning
Breaking changes need `/api/v2/`. Additive changes are fine in v1.

Related: [[API Endpoints]] · [[Security Model]]
