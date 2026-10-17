---
tags: [module]
module: reports
phase: 4
status: member dashboard (2.1–3.2), admin dashboard (4.1), admin reports + exports (4.5) implemented
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
- CSV (stdlib `csv`), Excel (`openpyxl`), PDF summary (`reportlab`), see ADR-018.
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

Step 2.3: the dashboard adds `open_cycle {public_id, name, ends_at, evaluations_given, members_left}` (or null).

## Implementation notes (step 4.1): admin dashboard
- `GET /api/v1/admin/reports/dashboard/` (IsSuperAdmin, `reports/api/admin_urls.py`, namespace `reports-admin`):
  `members {registered, active, pending, suspended, deactivated}` (role MEMBER only), `evaluations_submitted` (all periods),
  `cycles {DRAFT, OPEN, CLOSED, ARCHIVED}`, `open_cycle` (or null) with `evaluations_submitted`, `possible_pairs`, `submitted_pairs`,
  `participating_members`, `participation_percent`.
- **Participation** (REP-04 "clear explanations") = distinct submitted (evaluator, recipient) pairs ÷ pairs possible under the scope
  (ALL: E×R−R; SAME_SECTION: per section), counting only currently active members; resubmissions count once; `null` (not 0) when nothing is possible.
- Grouped counts use `.order_by()` to clear `Meta.ordering` (which would otherwise join the GROUP BY).
- Frontend `features/admin`: `AdminDashboardPage` (`/admin`) with a KPI row of `StatTile`s, open-period card with a participation `Meter`, period counts.
  `AdminNav` in the admin header (entries added as pages land). Shared `components/Meter` and `lib/vizTokens` (moved from the feedback feature).

## Implementation notes (step 4.5): reports & exports
- Data comes from `evaluations.selectors.report_evaluation_rows(...)` (ids only, **hidden evaluations left out**),
  `received_rating_rows`, `criterion_versions_info` (now includes `version`), `cycles_info` and
  `participation_by_member(cycle)` (one formula shared with `cycle_participation`, so the dashboard and the report agree).
- `selectors.choir_summary(cycle, submitted_from, submitted_to, voice_section, criterion)`: totals, criteria per **criterion
  version** (rated, not rated, average, average % of the scale), voice sections (by the section of the member evaluated) and a
  per-period trend. Criteria are hidden when rated n < threshold; sections and periods when distinct evaluators < threshold
  (REP-06, `min_aggregate_group_size`).
- `selectors.member_summary(public_id, …)`: Super Admin variant, **not** suppressed (n shown): received/given counts, criteria,
  trend. `selectors.participation_report(cycle)`: per active member given / possible / received / %.
- `exports.py`: `Document`/`Table` → `to_csv` / `to_xlsx` / `to_pdf` (A4, landscape when > 6 columns). `services.generate_export`
  builds the document, renders it, then `audit.record("reports.export.generated", metadata={report, file_type, filters, rows,
  identities})`. Validation errors (400) write no audit row.
- UI (`features/reports`, lazy): `/admin/reports` tabs Choir summary (filters in the URL) and Participation (defaults to the open
  period), `/admin/reports/members/:id`; tables with a `Meter` + the same value as text; "How these numbers work" panel (REP-04);
  `components/ExportButtons` + `lib/exports.exportUrl` (shared, also used by the evaluations browser for CSV/Excel with its filters).
  Links: member admin page → Report; participation row → member report → evaluations about them.
