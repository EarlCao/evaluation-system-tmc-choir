---
tags: [module]
module: evaluations
phase: 2-3
status: planned
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
- Moderation: `moderate(*, actor, evaluation, action, reason, comment=None)`

`submit_evaluation` and `edit_evaluation` always write an `EvaluationRevision`
(`revision_number` 1 on create, +1 on each edit), set `is_edited=True` on edits, and
publish events.

## Selectors
- `get_open_cycle()`, `get_cycle_form(cycle)` (criteria + scales for the form)
- `get_eligibility(viewer, recipient)` → `{can_evaluate, reason, existing_evaluation_public_id?}`
  (the reason uses the viewer's own data only)
- `list_my_evaluations(user, filters)`, `get_my_evaluation(user, public_id)`,
  `list_my_revisions(user, public_id)`
- Admin: `admin_list_evaluations(filters)`, `admin_get_evaluation(public_id)`,
  `admin_list_revisions(public_id)`, `list_moderation_queue()`
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
