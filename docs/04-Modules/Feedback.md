---
tags: [module, privacy]
module: feedback
phase: 3
status: planned
---
# Module: Feedback (anonymised read model)

**Backend:** `apps/feedback` (**no models**) · **Frontend:** `features/feedback`
**Requirements:** FB-01..06, MINE-05, MINE-06, REP-02, REP-04, REP-06 · **Rules:** BR-03, BR-06, BR-15, BR-16

## Responsibility
The **only** path through which a member sees feedback about themselves. It turns raw
evaluation rows into **anonymised DTOs** and **threshold-protected aggregates**. It is
kept as a separate module so the privacy boundary is explicit, small and easy to test.

## How it works
1. Calls `evaluations.selectors.received_feedback_rows(recipient, filters)`. That function
   returns whitelisted `.values()` rows: `id` (internal only), `cycle_id`, `submitted_date`
   (day precision), `is_edited`, ratings, comment/suggestion text, and
   `moderation_status`. It **never returns evaluator columns**.
2. Drops `HIDDEN` items and items from cycles whose `feedback_visibility = AFTER_CLOSE`
   that are not closed yet.
3. Replaces `id` with an opaque `feedback_id` (HMAC; see [[Privacy Model]]).
4. Orders by cycle, then by `feedback_id`.
5. Aggregates per criterion: `average`, `n`, distribution, but only when
   `n ≥ min_aggregate_group_size`. Otherwise `{"suppressed": true, "reason": "below_threshold"}`.
   Missing ratings are excluded, not counted as zero (BR-15).

## DTOs
```jsonc
// GET /api/v1/feedback/received/
{ "feedback_id": "K7Q2M9XWA1B3C5D8", "cycle": {"id": "...", "name": "Concert Prep 2026"},
  "date": "2026-11-03", "is_edited": true,
  "comment": "…", "suggestion": "…" }

// GET /api/v1/feedback/received/summary/?cycle=...
{ "evaluations_received": 7, "threshold": 3,
  "criteria": [ { "criterion": "Teamwork", "scale": {"type": "NUMERIC", "min": 1, "max": 5},
                  "n": 7, "average": 4.1, "distribution": {"1":0,"2":0,"3":2,"4":2,"5":3} } ],
  "trend": [ { "cycle": "…", "average": 3.8, "n": 6 } ] }
```
Proposed default (Q3): individual items do **not** include per-criterion ratings, only
text. Ratings appear as aggregates. Configurable later if the choir decides otherwise.

## API
`GET /api/v1/feedback/received/` (filters: `cycle`, `criterion`, `date_from`, `date_to`;
paginated) · `GET /api/v1/feedback/received/summary/` · `GET /api/v1/feedback/received/count/`

## Frontend (`features/feedback`)
"Feedback I Received": a banner explaining anonymity (FB-06), a count card, criterion
average cards (or a "not enough evaluations yet" state), a Recharts trend line, and a
comment/suggestion list with "Edited" chips and filters.

## Tests
- `assert_no_evaluator_leak` on every endpoint, with several evaluators (their
  ids/public_ids/usernames/emails/names never appear).
- `feedback_id` ≠ evaluation `public_id`, non-sequential, stable.
- Suppression below the threshold, including when filters shrink the group.
- Hidden or moderated items are excluded. AFTER_CLOSE visibility is respected.
- A member cannot query another member's feedback (there is no recipient parameter at all).

Related: [[Evaluations]] · [[Privacy Model]] · [[Reports]]
