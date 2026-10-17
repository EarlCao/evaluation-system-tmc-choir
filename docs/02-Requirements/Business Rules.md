---
tags: [requirements, rules]
---
# Business Rules

Enforced **server-side in services**, each covered by at least one test. Test docstrings
reference the `BR-xx` ID.

| ID | Rule | Enforced in |
|---|---|---|
| BR-01 | Members cannot evaluate themselves. | `evaluations.services.submit_evaluation` + DB `CheckConstraint(evaluator != recipient)` |
| BR-02 | Ordinary users can only create, view and edit **their own** submitted evaluations, subject to cycle settings. | `evaluations.selectors` (scoped querysets), `services.edit_evaluation` |
| BR-03 | A recipient sees feedback content and received counts, but **never** the evaluator's identity. | `feedback.selectors` (whitelisted fields) |
| BR-04 | Only the Super Admin can view evaluator identities and system-wide private records. | `IsSuperAdmin` + `admin_views` + audit |
| BR-05 | Every edit creates an **immutable revision**. Edits never silently overwrite. | `evaluations.services` + `EvaluationRevision` append-only |
| BR-06 | The recipient sees current content and may see it was **edited**, never the editor. | `feedback.selectors` |
| BR-07 | Criterion and scale versions used by historical evaluations remain available. | `CriterionVersion`/`FormVersion` immutable; archive instead of delete |
| BR-08 | All privileged access, exports, moderation and configuration changes are logged. | domain events → `audit.handlers`; direct `audit.services.record` for reads |
| BR-09 | Server-side permission checks are mandatory; hiding a React button is not security. | DRF permissions + service checks |
| BR-10 | Prevent XSS in comments, validate requests, rate-limit, protect against CSRF. | serializers, throttles, Django CSRF, React text rendering |
| BR-11 | HTTPS in production; never commit secrets. | `prod.py`, `.gitignore`, `.env.example` |
| BR-12 | One evaluation per (cycle, evaluator, recipient) unless the cycle allows resubmission. | service + `UniqueConstraint` |
| BR-13 | Evaluations can be submitted only while the cycle is `OPEN` and before `ends_at`. They can be edited only before `edit_deadline` (defaults to `ends_at`). | `evaluations.services` |
| BR-14 | Only `ACTIVE` members are evaluators or recipients. A recipient must be within the cycle's evaluation scope. | `evaluations.services.check_eligibility` |
| BR-15 | Missing ratings are excluded from averages, never counted as zero. Averages always show their `n`. | `reports`/`feedback` selectors |
| BR-16 | Member-visible aggregates are suppressed when `n < min_aggregate_group_size` (default 3). | `feedback.selectors`, `reports.selectors` |
| BR-17 | Moderation never deletes. Hidden content is retained with full moderation history. | `evaluations.services.moderate` |
| BR-18 | A published `FormVersion` attached to an OPEN cycle can no longer change. Changes create a new version. | `evaluations.services` |

Related: [[Functional Requirements]] · [[Privacy Model]] · [[Security Model]]
