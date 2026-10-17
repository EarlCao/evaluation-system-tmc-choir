---
tags: [testing, privacy, review]
---
# Privacy Review: 2026-10-17 (step 3.4)

Scope: every member-facing endpoint and UI path after Phases 1–3. Goal: prove that a member cannot learn who evaluated
them ([[Privacy Model]]) and keep it provable as the code grows.

## Method
Automated sweep: `backend/apps/feedback/tests/test_privacy_sweep.py` (runs in CI with the rest of `pytest`).

| Check | How | Result |
|---|---|---|
| Every member GET endpoint (18) as the recipient R of 4 evaluators (one edited, one hidden) | Walks the URL resolver; `assert_no_evaluator_leak` (ids, public_ids, usernames, emails, names) + identity keys | ✅ after fixes below |
| Completeness | Resolver routes == swept routes ∪ write-only routes; a new member endpoint without a sweep entry **fails** | ✅ |
| Directory / member profile (legitimately show names) | Identity-key check + exact key set: an evaluator's profile has nothing about evaluating you | ✅ |
| Feedback content | Only the current text; pre-edit text and moderated-hidden text never reach the recipient | ✅ |
| Error messages | Someone else's evaluation (incl. one *about* you) → `404 {"code":"not_found","message":"Not found."}`, identical to a random id | ✅ |
| Admin API (all `/api/v1/admin/` routes, GET/POST/PATCH) | Member → 403/405 for every route; permission checked before lookup | ✅ |
| Django admin / OpenAPI docs | Member → login redirect / 403 | ✅ |
| Caching | API responses carry `Cache-Control: no-store` (new `PrivateApiCacheMiddleware`) | ✅ (new) |
| Logs | Full submit + read flow at DEBUG: no comment text, usernames or emails in log output | ✅ |
| Frontend | `grep evaluator frontend/src`: only a code comment stating no such field exists; feedback rendered as text (tests check `<script>` text isn't executed/parsed) | ✅ |

## Findings & fixes
1. **`GET /evaluations/mine/{id}/revisions/` returned an `editor` object.** On that endpoint the editor is always the author, so nothing
   leaked, but it was an identity-bearing field no screen needed. **Fixed:** removed from the member serializer (the Super Admin view keeps it, 4.4).
2. **No cache policy on private API responses.** **Fixed:** `Cache-Control: no-store` on `/api/` responses.
3. **Self-identification in free text** (an evaluator signing their comment) can't be prevented by the system. This is the accepted residual risk
   (Privacy Model). Follow-up idea: warn the author in the UI when a comment contains their own name or username.

## Residual risks (unchanged, documented)
Writing style; count timing (mitigations: debounced notifications in 5.2, `AFTER_CLOSE` visibility); small choirs (threshold ≥ 3, ADR-013).
