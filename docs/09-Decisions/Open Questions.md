---
tags: [decisions, open-questions]
---
# Open Questions (Spec §13: Decisions to Confirm Before Development)

Each question has a **proposed default** that the design already assumes. When the choir
confirms or changes one, update its status and the affected notes.

> [!success] 2026-10-18
> The user confirmed **all ten defaults** as final. Each remains changeable later through the setting or
> per-period option listed in the *Configurable?* column.

| # | Question | Proposed default | Configurable? | Needed by step | Status |
|---|---|---|---|---|---|
| Q1 | Open registration, or Super Admin approval? | **Approval required** (`registration_mode = APPROVAL`); email verification optional | yes (setting) | 1.4 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q2 | Can every member evaluate every other member, or is it limited by section/role/cycle? | **Everyone active evaluates everyone active except themselves.** Per-cycle `evaluation_scope = ALL \| SAME_SECTION`. Members flagged `is_evaluable = false` are excluded | yes (per cycle) | 2.2 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q3 | Should members see individual ratings per submission, only aggregates, or both? | **Aggregates only** (≥ 3 evaluations) for ratings. Comments and suggestions listed individually, anonymised | could be made configurable | 3.2 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q4 | Are comments visible immediately, or only after Super Admin review? | **Immediately**, with Super Admin able to flag/hide afterwards. Per-cycle `feedback_visibility = AFTER_CLOSE` releases everything at cycle end | yes (per cycle) | 3.2 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q5 | How long can members edit after submitting? | **Until the cycle's `edit_deadline`** (defaults to the cycle end date) | yes (per cycle) | 3.1 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q6 | More than one evaluation for the same person in a cycle? | **No.** One per pair per cycle; edit instead. `allow_resubmission` exists per cycle | yes (per cycle) | 2.3 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q7 | Notification channels: in-app, email, or both? | **In-app + real-time.** Email only for password reset and verification | later | 5.2 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q8 | Choir time zone? | `UTC` until confirmed | yes (setting `time_zone`) | 1.3 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q9 | Can the Super Admin also submit evaluations? | **No.** The Super Admin moderates and does not evaluate (keeps roles separate) | – | 2.3 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |
| Q10 | Are profile photos needed? | **No in v1** (Pillow is installed only because the PDF export needs it, step 4.5) | – | 2.1 | ✅ **Confirmed 2026-10-18** (default kept; user confirmed all defaults) |

Related: [[Decisions Log]] · [[Business Rules]]
