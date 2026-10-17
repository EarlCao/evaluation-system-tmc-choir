---
tags: [overview]
---
# Glossary

| Term | Meaning |
|---|---|
| **Member** | A registered choir member with role `MEMBER`. |
| **Super Admin / God Mode** | Role `SUPER_ADMIN`; full access including evaluator identities. |
| **Evaluator** | The member who writes an evaluation. |
| **Recipient** | The member being evaluated. |
| **Evaluation** | One submission by an evaluator about a recipient in a cycle: ratings + comment + suggestion. |
| **Rating Criterion** | A dimension being rated (attendance, preparation, teamwork, discipline, vocal performance, participation…). |
| **Criterion Version** | Immutable snapshot of a criterion's name, scale, limits and labels. Evaluations reference versions. |
| **Scale type** | `NUMERIC` (e.g. 1–5 points/stars) or `PERCENT` (0–100), with min/max/step and labels. |
| **Form Version** | Immutable, published set of criterion versions + comment/suggestion rules used by a cycle. |
| **Evaluation Cycle** | A period (rehearsal month, concert prep, semester) with start/end, edit deadline, status and rules. |
| **Revision** | Immutable snapshot written on every create/edit of an evaluation. |
| **Feedback** | The **anonymised** view of evaluations, as the recipient sees it. |
| **Privacy threshold** | `min_aggregate_group_size` (default 3). Aggregates are hidden when fewer evaluations exist. |
| **Moderation** | Super Admin flags or hides inappropriate feedback; the original is retained. |
| **Audit Log** | Append-only record of security-sensitive events. |
| **Domain event** | In-process message published by a service (e.g. `evaluations.evaluation.submitted`), consumed by audit or notifications. |
| **Modular monolith** | One deployable app, internally split into modules with strict boundaries. |
