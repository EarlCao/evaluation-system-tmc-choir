---
tags: [module]
module: evaluations
phase: 2-3
status: configuration (2.2), submissions (2.3), editing + revisions (3.1), admin browser + moderation (4.4) implemented
---
# Module: Evaluations

**Backend:** `apps/evaluations` · **Frontend:** `features/evaluations` (+ admin screens in `features/admin`)
**Requirements:** EVAL-01..08, CFG-01..06, MINE-01..07, ADM-02, ADM-05 · **Rules:** BR-01, 02, 05, 07, 12–14, 17, 18

## Responsibility
The **write side** of the evaluation domain: rating criteria and their versions,
published form versions, evaluation cycles, submissions (ratings + comment +
suggestion), immutable revisions, moderation. It also exposes the **author's own** views
and the **admin** identity-bearing views. Recipient-facing reads belong to [[Feedback]].

## Models (details in [[Data Model]])
| Model | Purpose | Mutability |
|---|---|---|
| `CriterionCategory` | grouping (Musicianship, Conduct…) | editable / archivable |
| `RatingCriterion` | stable identity of a criterion (`key`, category, sort order, `is_active`, `is_archived`) | editable / archivable |
| `CriterionVersion` | name, description, `scale_type`, min, max, step, `labels` JSON, `is_required`, `version` | **immutable** |
| `FormVersion` | published bundle: criterion versions + comment/suggestion rules + limits | **immutable once published** |
| `FormVersionItem` | (form_version, criterion_version, order) | immutable |
| `EvaluationCycle` | name, dates, `edit_deadline`, status, `form_version`, rules | editable while DRAFT; limited when OPEN |
| `Evaluation` | evaluator, recipient, cycle, form_version, status, `current_revision`, `is_edited`, `moderation_status` | via services only |
| `EvaluationRating` | (evaluation, criterion_version, value, label) | rewritten on edit; history kept in revisions |
| `EvaluationComment` | (evaluation, kind COMMENT/SUGGESTION, body, moderation_status) | rewritten on edit; history kept in revisions |
| `EvaluationRevision` | full JSON snapshot, `revision_number`, editor, change_summary | **append-only** |
| `ModerationAction` | FLAG / HIDE / RESTORE, reason, actor, target | **append-only** |

### Scales (CFG-02, CFG-03)
`scale_type ∈ {NUMERIC, PERCENT}`. Validation: `min < max`, `step > 0`,
`(max-min) % step == 0`, and `labels` keys ∈ allowed values. Examples:
- Points 1–5, step 1, labels `{1: "Needs Improvement", 3: "Satisfactory", 5: "Excellent"}`
- Percent 0–100, step 5

### Cycle settings (CFG-05, EVAL-06)
`starts_at`, `ends_at`, `edit_deadline` (default `ends_at`), `status`
(`DRAFT → OPEN → CLOSED → ARCHIVED`), `allow_resubmission` (bool),
`evaluation_scope` (`ALL` | `SAME_SECTION`), `feedback_visibility`
(`IMMEDIATE` | `AFTER_CLOSE`). Only one cycle may be OPEN at a time (proposed default).

## Services
- Config: `create_criterion`, `update_criterion` (creates a new `CriterionVersion`),
  `reorder_criteria`, `set_criterion_active`, `archive_criterion`, `publish_form_version`,
  `create_cycle`, `update_cycle`, `open_cycle`, `close_cycle`, `archive_cycle`
- Submission: `check_eligibility(evaluator, recipient, cycle)`, `submit_evaluation(...)`,
  `edit_evaluation(*, editor, evaluation, ratings, comment, suggestion, change_summary)`
- Moderation: `moderate(*, actor, evaluation, action, target, reason)`; `record_identity_access(*, actor, view, evaluation=None, **details)`

`submit_evaluation` and `edit_evaluation` always write an `EvaluationRevision`
(`revision_number` 1 on create, +1 on each edit), set `is_edited=True` on edits, and
publish events.

## Selectors
- `get_open_cycle()`, `get_cycle_form(cycle)` (criteria + scales for the form)
- `get_eligibility(viewer, recipient)` → `{can_evaluate, reason, existing_evaluation_public_id?}`
  (the reason uses the viewer's own data only)
- `list_my_evaluations(user, filters)`, `get_my_evaluation(user, public_id)`,
  `list_my_revisions(user, public_id)`
- Admin: `admin_list_evaluations(**filters)`, `admin_get_evaluation(public_id)`,
  `admin_list_revisions(evaluation)`, `moderation_queue()`, `count_needing_moderation()`
- For [[Feedback]] and [[Reports]]: `received_feedback_rows(recipient, filters)` returns
  whitelisted `.values()` rows **without evaluator columns**.

## Events published
`evaluations.cycle.opened/closed`, `evaluations.criterion.changed`,
`evaluations.form.published`, `evaluations.evaluation.submitted/edited/moderated`

## Frontend (`features/evaluations`)
- **Evaluate a Member**: dynamic form built from the cycle's form version
  (RatingInput per scale type), comment + suggestion with live character counters,
  then a **review & confirm** step showing `PrivacyNotice` (EVAL-07). Submit, then a
  success page.
- **My Submitted Evaluations**: list with cycle filter, "Edited" chips, and an edit
  button while the window is open.
- **Evaluation Details & Revision History**: current content plus a revision timeline
  with a diff (original vs edited, timestamp, editor = me).

## Tests (must include)
Self-evaluation is blocked (BR-01); duplicates are blocked unless resubmission is
allowed (BR-12); a closed cycle is blocked (BR-13); inactive and out-of-scope recipients
are blocked (BR-14); scale validation; required criteria and comments; every create and
edit adds a revision (BR-05); revisions cannot be updated or deleted; another member's
evaluation returns 404; historical evaluations keep their criterion versions after a
criterion edit (BR-07); moderation keeps the original (BR-17).

Related: [[Feedback]] · [[Data Model]] · [[Privacy Model]]

## Implementation notes (step 2.2): configuration
- **Models:** `CriterionCategory`, `RatingCriterion` (+ `current_version`), `CriterionVersion` (**AppendOnlyModel**;
  DB checks `max > min`, `step > 0`; unique `(criterion, version)`), `FormVersion` (save() refuses changes once PUBLISHED),
  `FormVersionItem`, `EvaluationCycle` (DB checks `ends_at > starts_at`, `edit_deadline ≥ starts_at`;
  **`is_current` nullable-unique**, so at most one OPEN cycle at DB level, ADR-017). FKs from immutable rows use PROTECT.
- **Scales** (`scales.py`): NUMERIC or PERCENT (0–100); min ≥ 0, max > min, step > 0 dividing the range exactly,
  ≤ 101 points; label keys must be scale points (normalised: `"4"`, `"2.5"`), texts 1–60 characters.
- **Services:** `create/update_category`; `create_criterion` (v1, unique slug key), `update_criterion` (wording or scale
  change → **new version**; category / is_active in place; archived → 409), `reorder_criteria` (must list all), `archive_criterion`;
  `create/update_form_version` (draft only; ≥ 1 active, unique criteria; text limits 1–5000), `publish_form_version`
  (re-points items to the **current** versions, then freezes); `create/update_cycle` (edit_deadline defaults to ends_at;
  fields editable per status: DRAFT all, OPEN name/description/ends_at/edit_deadline, CLOSED/ARCHIVED name/description),
  `open_cycle` (needs a published form, end in the future, no other open cycle), `close_cycle`, `archive_cycle`.
- **Events** (all audited): `category.changed`, `criterion.changed` (action, version, changes), `form.changed`,
  `form.published` (criterion_version_ids), `cycle.changed`, `cycle.opened`, `cycle.closed`.
- **Admin API** (`api/admin_urls.py`, mounted at `/api/v1/admin/`, `IsSuperAdmin` everywhere): see [[API Endpoints]].
  Decimals are JSON numbers (`COERCE_DECIMAL_TO_STRING = False`).
- **`manage.py seed_demo_data [--open-cycle] [--members N]`**: idempotent; the 6 spec criteria (1–5 with labels),
  "Standard choir evaluation" form (published) and "Demo cycle" (draft). `--members` needs `DEMO_MEMBER_PASSWORD`.
  The dev DB was seeded (no members).
- Cycles past `ends_at` stay OPEN until closed; submission checks the time window (2.3). An auto-close job is a later follow-up.

## Implementation notes (step 2.3): submissions
- **Models:** `Evaluation` (DB check `evaluator ≠ recipient`; unique `(cycle, evaluator, recipient, submission_number)`;
  indexes on (recipient, cycle), (evaluator, cycle), (cycle, submitted_at)), `EvaluationRating` (value NULL = not rated;
  label snapshot), `EvaluationComment` (COMMENT / SUGGESTION, row only when non-empty), `EvaluationRevision` (**append-only**, snapshot JSON).
- **`rules.py`** is shared by the eligibility endpoint and the submit service, so they can't disagree. Order:
  SELF → NOT_A_MEMBER (no profile, e.g. Super Admin, Q9) → NO_OPEN_CYCLE → NOT_STARTED / ENDED → NOT_EVALUABLE →
  OUT_OF_SCOPE (SAME_SECTION) → ALREADY_EVALUATED (unless `allow_resubmission`). Reasons describe only the viewer's own situation.
  Inactive or unknown recipients → 404. `can_edit` = SUBMITTED + cycle OPEN + now ≤ edit_deadline.
- **`services.submit_evaluation`:** the server picks the open cycle (the client never chooses). Ratings and texts are validated
  together, so all errors come back at once (`fields.ratings.{criterion_version_id}`, `fields.comment`, `fields.suggestion`).
  Required criteria, values on the scale (min/max/step), no unknown or duplicate criteria, required texts and length limits.
  Text is cleaned (`text.clean_text`: CRLF → LF, control/format characters dropped, NFC, trimmed). Writes evaluation +
  ratings + comments + **revision 1** atomically. Publishes `evaluation.submitted` (IDs only). A duplicate race → IntegrityError → 409.
- **Services package:** `services/config.py` + `services/submissions.py`, re-exported from `services/__init__.py`.
- **Member API:** `GET /evaluation-cycles/current/` → `{cycle|null}`, `GET /evaluation-cycles/{id}/form/` (non-draft),
  `GET /evaluations/eligibility/?recipient=`, `POST /evaluations/` (throttle `evaluation_submit` 30/h/user),
  `GET /evaluations/mine/` (`?cycle=`), `GET /evaluations/mine/{id}/` (author only; the recipient gets 404).

## Implementation notes (step 2.4): frontend
- `features/evaluations`: `EvaluateMemberPage` (`/app/members/:publicId/evaluate`), `MyEvaluationsPage`
  (`/app/my-evaluations`), `MyEvaluationDetailPage` (`/app/my-evaluations/:publicId`).
- Evaluate flow: eligibility, current cycle and its form are loaded. Ineligible → reason message (+ link to the existing
  evaluation). Eligible → a **dynamic form**: `schema.buildDraftSchema(form)` generates a Zod schema from the form
  definition (required criteria, text limits). `RatingInput` renders buttons for NUMERIC ≤ 11 points and a slider otherwise,
  optional criteria can be cleared, and the chosen label is announced. Comment/suggestion have counters. **Review step** = read-only
  `EvaluationSummary` + `PrivacyNotice` (server text from `/system/public/`, built-in fallback), focus moves to its heading.
  Submit → success screen. Server field errors (nested `ratings.{id}`) go back to the form with the draft kept (NFR-04); 409 shows on the review step.
- `members` → `evaluations` dependency avoided: the profile page only links to `/evaluate`; eligibility is checked on that page (ADR-004 style).
- `lib/errors.FieldErrors` supports nested errors; `lib/forms.applyServerErrors` maps dotted paths under known prefixes.
- Nav: Dashboard · Members · My evaluations. The dashboard shows open-cycle progress (`evaluations_given`, `members_left`).

## Implementation notes (step 3.1): editing & revisions
- `services.edit_evaluation(editor, evaluation_public_id, ratings, comment, suggestion, change_summary)`:
  author only (others → 404 via `get_my_evaluation`); `rules.can_edit` (SUBMITTED, cycle OPEN, now ≤ edit_deadline;
  the deadline may be after `ends_at`) else 409 "The edit window for this evaluation has closed."
  Validated against the evaluation's **own** form version (BR-07). Runs under `select_for_update`. Identical snapshot →
  **no-op** (no revision). Otherwise rewrite content, add revision `n+1` (editor, change_summary ≤ 200, default "Edited"), set
  `is_edited`, `current_revision_number`, `last_edited_at`, and publish `evaluation.edited` (`revision_number` only; content stays in revisions, AUD-05).
- Comment `moderation_status` is carried over per kind on rewrite, so an edit can't un-hide moderated text.
- API: `PATCH /evaluations/mine/{id}/` (throttled for PATCH only), `GET /evaluations/mine/{id}/revisions/` →
  `[{revision_number, created_at, editor{public_id, first/last name}, change_summary, snapshot}]`, author only.

## Implementation notes (step 3.3): edit & history UI
- `components/EvaluationForm` is shared by evaluate (create) and edit; edit mode adds an optional "What did you change?" (≤ 200) on the review step.
- My evaluation detail: "Edit evaluation" only while `can_edit` (otherwise "The edit window … has closed"). Uses the cycle's frozen form.
  "Saved as revision N" confirmation.
- `RevisionHistory`: author-only timeline (newest first), the changes in words (`revisions.describeChanges`: "Attendance: 3 → 5",
  "Comment changed"), and the full snapshot in `<details>`. It states that only the author and the Super Admin can see it.

## Implementation notes (step 4.3): configuration UI
- `/admin/cycles` (list) and `/admin/cycles/new|:id`: settings form whose disabled fields mirror the server's per-status rules
  (`CYCLE_EDITABLE`); local-time `datetime-local` ↔ UTC ISO (`lib/datetime`); empty edit deadline = the end; only published forms are offered.
  Transitions (Open → Close → Archive) are behind `ConfirmDialog`s that explain the consequences; server conflicts (e.g. "Another cycle is already open") are shown.
- `/admin/criteria`: display order with ↑/↓ (`reorder`), active switch, archive (confirm), version shown; `CriterionDialog` for create/edit
  with a Zod schema mirroring `scales.py` (step divides the range, ≤ 101 points, percent ≤ 100, min ≥ 0), labels per point for ≤ 11 points,
  a version note in edit mode and the version history. Categories: list + add.
- `/admin/forms` and `/admin/forms/new|:id`: draft editor (title, criteria checklist kept in display order, comment/suggestion rules and limits),
  "Publish…" (freeze warning; enabled once saved), a published form is read-only with "Copy into a new draft" (`?from=`).
- **Bug found by the tests:** label inputs named `labels.1`, `labels.2` made React Hook Form treat labels as an array, so Zod rejected it on an
  invisible field and the dialog silently refused to submit. Fix: labels are held as an array by point position and mapped to point keys on submit;
  any `labels` error is now shown.

## Implementation notes (step 4.4): all-evaluations browser & moderation
- **The only identity-bearing reads.** `selectors.admin_*` / `moderation_queue` join evaluator and recipient. Every API
  request that serves them calls `services.record_identity_access` → `audit.services.record(event_type="admin.sensitive_access")`
  **synchronously** (the documented direct-call exception), so a read that can't be audited fails. Metadata: `view`
  (`evaluations.list` / `.moderation_queue` / `.detail` / `.revisions`), plus `filters`, `page`, `results` for lists or the
  evaluation `target_id` for detail/revisions. Invalid filters → 400 and **no** entry (nothing was revealed).
- Filters (`GET /admin/evaluations/`): `recipient`, `evaluator`, `cycle`, `criterion` (public ids), `rating_min`/`rating_max`
  (applied to `criterion` when given, else to any rating), `submitted_from`/`submitted_to` (dates, UTC), `moderation`
  (`VISIBLE`/`FLAGGED`/`HIDDEN`/`attention`), `edited`. Newest first, paginated.
- `moderate(actor, evaluation, action, target, reason)`: target = `EVALUATION`, `COMMENT` or `SUGGESTION`; FLAG → FLAGGED,
  HIDE → HIDDEN, RESTORE → VISIBLE. Reason required for FLAG/HIDE (≤ 300). Same status → 409; missing text → 409.
  Runs under `select_for_update`, appends a `ModerationAction`, publishes `evaluations.evaluation.moderated` (audited with
  before/after). **Nothing is deleted (BR-17).** HIDDEN disappears from the recipient's feedback at once; FLAGGED stays visible.
- Moderation queue = the evaluation **or** one of its texts is FLAGGED (oldest first). The admin dashboard shows `needs_moderation`.
- The admin revision view includes the `editor` (members' revision view never does, step 3.4).
- UI (`features/admin`): `/admin/evaluations` (filters in the URL; recipient/evaluator chips; links from a member's admin page:
  "Evaluations about them / they wrote"), `/admin/evaluations/:id` (identities, ratings, texts with Flag/Hide/Restore or
  Clear flag, moderation history, revisions with editor and changes), `/admin/moderation`. Every page states that access is logged.
  Texts render as plain text (`pre-wrap`), never HTML.
## Implementation notes (step 6.0): automatic closing & signed comments
- `services.close_expired_cycles(now=None)` closes every OPEN cycle whose `ends_at` has passed (actor = system, so the
  audit row has no actor); runs every minute from `manage.py close_expired_cycles` (compose `worker`; cron in production).
  Closing triggers the usual notifications and releases AFTER_CLOSE feedback.
- The evaluation form warns (never blocks) when the comment or suggestion contains the writer's own first name, last name,
  display name or username as a whole word (case- and accent-insensitive, names of 3+ letters): `identity.ownNameMentions`.
  Shown under the text fields and again on the review step (Privacy Model, residual risk "writing style").
