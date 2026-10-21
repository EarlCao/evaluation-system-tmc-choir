---
tags: [module, privacy]
module: feedback
phase: 3
status: backend (3.2) + UI (3.3) implemented
---
# Module: Feedback (anonymised read model)

Deployment review (2026-10-21): aggregate thresholds count **distinct evaluators**.
Trends exclude criterion/cycle buckets below the threshold; missing ratings and
resubmissions cannot satisfy a privacy floor. See [[Deployment Readiness 2026-10-20]].

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

## Implementation notes (step 3.2)
- **Data access:** only `evaluations.selectors.received_feedback_rows / received_comment_rows / received_rating_rows /
  criterion_versions_info / cycles_info`, all with explicit `.values()` whitelists (`FEEDBACK_ROW_FIELDS = id, cycle_id,
  submitted_at, is_edited`). There are no evaluator columns and no `Evaluation` instances.
- **Visibility:** SUBMITTED only; evaluation-level HIDDEN excluded entirely; comment-level HIDDEN text omitted; DRAFT cycles never;
  `AFTER_CLOSE` cycles hidden while OPEN.
- **Items** (`list_received`): `feedback_id` = first 16 chars of base32(HMAC-SHA256(`FEEDBACK_ID_KEY`, "evaluation_pk:recipient_pk")),
  cycle {public_id, name}, `date` (day in the system time zone), `is_edited`, comment, suggestion. Evaluations without visible text
  aren't listed (but are counted). Order: newest cycle first, then `feedback_id`, so never by submission time.
- **Summary:** per criterion *version* (one scale per entry): `n` (non-null values only), `suppressed` = n < threshold, `average`
  (2 dp) and `distribution` only when not suppressed. Trend per cycle: `average_percent` of scale span, suppressed when the cycle has
  fewer evaluations than the threshold. `evaluations_received` is always shown (FB-03).
- **API:** `GET /feedback/received/` (`cycle`, `date_from`, `date_to`, `page`; DRF envelope), `/received/summary/`
  (`cycle`, `criterion`), `/received/count/`. There is **no recipient parameter**: it is always the logged-in user.
- The dashboard adds `feedback_received`.
- **Tests:** `assert_no_evaluator_leak` with all evaluators on list, summary, count and dashboard; whitelist keys; opaque id ≠ public_id;
  time-neutral order; moderation; AFTER_CLOSE; thresholds 2 vs 3 vs a raised setting; missing ≠ zero; criterion filter; ≤ 12 queries.

## Implementation notes (step 3.3): "Feedback I received" page (`/app/feedback`)
- **Anonymity banner** (FB-06): anonymous to you and other members; the Super Admin can see who submitted.
- **Filter row** above everything: the evaluation period (options = periods in the unfiltered summary) scopes the tiles, chart and list.
  The date range ("Comments from / until") applies to the comment list only and is labelled that way. The criterion filter exists in the API but isn't exposed (every criterion already has a tile).
- **Form choice (dataviz):** "Evaluations received" = stat tile. Each criterion = stat tile + **meter** (`role="meter"`,
  value always written as text, fill/track from one blue ramp); suppressed criteria say "Not enough evaluations yet (shown from N)".
  **Trend** = single-series line (2px, ringed 8px markers, solid hairline grid, one 0–100% axis, crosshair tooltip with the value first,
  endpoint direct label, no legend) + a **table twin** in `<details>`. Suppressed periods are **gaps, never zeros**. Shown only for "All periods" with ≥ 2 periods.
- **Colors:** slot-1 blue `#2a78d6` light / `#3987e5` dark via CSS variables (`vizTokens.ts`, MUI `applyStyles("dark")`); validated with
  the dataviz validator against the real surfaces (#ffffff, #121212): all checks PASS. Rendered to PNG in both modes and inspected; x-axis padded after review.
- The comment list is plain text with an "Edited" chip; dates use day precision; it's paginated.
- **Lazy route:** the page (and Recharts) loads in its own chunk (366 kB); the main bundle stays at 865 kB.
