---
tags: [architecture, privacy, critical]
---
# Privacy Model

> [!danger] Core guarantee
> A member must never be able to determine **who** evaluated them. Only the
> **Super Admin** can see evaluator identities, and every such access is audit-logged.

## Who sees what

| Data | Recipient | Author (evaluator) | Other members | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Evaluator identity | ❌ | ✅ (self) | ❌ | ✅ (logged) |
| Recipient identity | ✅ (self) | ✅ | ❌ | ✅ |
| Current ratings | aggregates only (≥ threshold)¹ | ✅ own | ❌ | ✅ |
| Current comment / suggestion text | ✅ (if visible) | ✅ own | ❌ | ✅ |
| "Edited" flag | ✅ | ✅ | ❌ | ✅ |
| Revision history (old content, editor, timestamps) | ❌ | ✅ own | ❌ | ✅ |
| Exact submission timestamp | ❌ (day precision) | ✅ own | ❌ | ✅ |
| Evaluation `public_id` | ❌ | ✅ own | ❌ | ✅ |
| Moderation status / history | only "hidden" items are excluded | status of own | ❌ | ✅ |
| Count of evaluations received | ✅ | – | ❌ | ✅ |

¹ Proposed default for Open Question Q3: per-criterion ratings are shown to the recipient as
**aggregates** (average, n, distribution) only when `n ≥ min_aggregate_group_size`
(default **3**). Individual comments and suggestions are listed without any identity.
See [[Open Questions]].

## Enforcement layers (defence in depth)

1. **Separate read model:** the recipient view is served **only** by `apps/feedback`.
   Its selectors build results with explicit `.values(...)` whitelists that never
   include `evaluator_id` or any join to the evaluator. `feedback` has no serializer
   that can reach an `Evaluation` instance directly.
2. **Opaque IDs:** feedback items use
   `feedback_id = base32(HMAC_SHA256(FEEDBACK_ID_KEY, f"{evaluation.pk}:{recipient.pk}"))[:16]`.
   The value is stable, non-sequential, and different from the `public_id` the author
   sees, so author and recipient views cannot be cross-referenced.
3. **Coarse time and neutral ordering:** recipients get dates at day precision only.
   The default order is by cycle, then by `feedback_id` (pseudo-random but stable), not
   by submission time.
4. **Aggregation thresholds:** averages, trends and breakdowns (by voice section,
   criterion or date bucket) are suppressed when `n < min_aggregate_group_size`. The UI
   shows "Not enough evaluations yet to show averages".
5. **Separate serializers:** member serializers (`api/serializers.py`) and admin
   serializers (`api/admin_serializers.py`) are different classes. `fields = "__all__"`
   is forbidden.
6. **Notifications:** member notifications carry generic text and a link to
   `/app/feedback`. They are **debounced** (at most one "new feedback" notification per
   recipient per window, default 60 min) to reduce timing correlation: the notice is created at
   the **end** of the window that the first submission opened, never at submission time, and it
   is skipped while an earlier one is unread. AFTER_CLOSE cycles hold notices until the cycle
   closes (ADR-020). WS payloads carry no IDs that point to an evaluation; tests assert that
   evaluator names, usernames and public ids appear nowhere in the notification or its push.
7. **Exports and reports:** member-available exports contain only their own anonymised
   feedback. Identity-bearing reports exist only in `admin` endpoints.
8. **Logs:** application logs never write comment text or evaluator/recipient pairs.
   The audit log holds them, and only the Super Admin can read it.
9. **Errors:** error messages never confirm another member's activity (e.g. no
   "X already evaluated you").
10. **URLs:** no evaluator IDs in any member-facing URL or query string.
11. **Admin identity access logging:** every `admin` list/detail/export of evaluations
    calls `audit.services.record(event="admin.sensitive_access", ...)`.
12. **Tests:** a reusable privacy assertion helper
    (`assert_no_evaluator_leak(response, evaluator)`) checks every member-facing
    endpoint. It scans the JSON for the evaluator's id, public_id, username, email
    and names. See [[Testing Strategy]].

13. **No caching:** every `/api/` response is `Cache-Control: no-store` (shared computers, proxies).
14. **Automated sweep:** `apps/feedback/tests/test_privacy_sweep.py` checks every member endpoint and fails if a new one isn't covered.
    Results: [[Privacy Review 2026-10-17]].

## User-facing disclosure (FB-06, SET-03)
The evaluate form's confirmation step shows:

> *Your name will **not** be shown to the member you evaluate or to other members. The
> **Super Admin** can see who submitted each evaluation. Edits are kept in a history that
> only you and the Super Admin can see.*

The full privacy notice is editable in [[System Settings]] and shown at `/privacy`.

## Residual risks (accepted, documented)
- **Self-identification:** an evaluator may sign or describe themselves in a comment. Follow-up: warn authors when a comment contains their own name.
- **Small choirs and writing style:** comment wording can reveal an author. The UI
  advises constructive, neutral wording. The threshold protects numeric aggregates only.
- **Count timing:** a recipient who watches their count increase right after talking to
  someone may infer identity. Mitigations: debounced notifications, and an optional cycle
  setting `feedback_visibility = AFTER_CLOSE` that releases all feedback at once.

Related: [[Feedback]] · [[Security Model]] · [[Business Rules]]
