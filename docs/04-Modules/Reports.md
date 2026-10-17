---
tags: [module]
module: reports
phase: 4
status: member dashboard endpoint started (2.1); admin reports in 4.1 / 4.5
---
# Module: Reports & Analytics

**Backend:** `apps/reports` (no models in v1) · **Frontend:** `features/reports`, `features/dashboard`, admin dashboard in `features/admin`
**Requirements:** ADM-01, ADM-07, REP-01..06 · **Rules:** BR-15, BR-16

## Responsibility
Read-only aggregations and exports for the **Super Admin**, plus the member dashboard
summary (which reuses [[Feedback]] for anything about received feedback).

## Reports
| Report | Contents | Identities? |
|---|---|---|
| Dashboard stats (ADM-01) | registered, active, pending, evaluations submitted/received, participation rate, cycle status | no |
| Individual member summary | per-criterion averages (n), counts given/received, trend, comments | admin variant may include evaluators |
| Choir-wide summary | per-criterion averages, distributions, by voice section | no (small-group suppression still shown as a warning) |
| Participation report | per member: evaluations given / possible, received | evaluator-level (admin only) |
| Evaluator detail export | every evaluation with evaluator + recipient | **yes, admin only, audited** |

**Participation rate** = evaluations submitted in cycle ÷ possible
(eligible evaluator × recipient pairs in scope). The formula is shown in the UI (REP-04).

## Exports (ADM-07)
- CSV (stdlib `csv`), Excel (`openpyxl`), PDF summary (`reportlab` or
  `weasyprint`, decided in Phase 4 via ADR).
- Every export calls `audit.services.record("reports.export.generated", filters, actor)`.
- Streaming responses for large CSVs. Filenames contain no personal names.

## API
`GET /api/v1/admin/reports/dashboard/`, `/admin/reports/members/{public_id}/`,
`/admin/reports/choir/`, `/admin/reports/participation/`, `/admin/reports/export/?type=&format=`.
Member: `GET /api/v1/dashboard/` (own counts, open cycle, pending evaluations to do).

## Tests
Averages ignore missing values; division by zero is handled; thresholds apply to
breakdowns; members get 403 on every admin report; each export is audited.

Related: [[Feedback]] · [[Audit]] · [[Evaluations]]

## Implementation notes (step 2.1)
`apps/reports` exists with `selectors.member_dashboard(user)` → `{active_members, voice_section}` at
`GET /api/v1/dashboard/`. Steps 2.3 (open cycle, evaluations to do) and 3.2 (feedback received) extend it.
Frontend `features/dashboard`: `DashboardPage` (greeting, stat cards, shortcuts).
