---
tags: [roadmap, log]
---
# Progress Log

Newest entry first. Use [[Phase Log Template]] for each completed step.

## 2026-10-22 · Step 7.6: Safe Gmail failure diagnostics

**Observed:** the user still receives registration 503 after configuring Gmail OAuth.
Supplied production logs show only `Transactional email delivery failed (OSError)`,
which hides whether Google rejected token refresh or message submission. The live
provider failure remains unclassified; no claim is made that credentials are fixed.

**Changed:** rejected Gmail HTTPS responses now log the endpoint label, HTTP status,
and an allowlisted Google error code. Parsing reads at most 16 KiB. Unknown/malformed
provider content becomes `unknown`; free-text messages, tokens, recipient addresses,
and OTPs never enter the diagnostic log. The public error remains generic. Updated
[[Core]] and [[Gmail on Render Free]] with log examples and troubleshooting guidance.
No dependencies, migrations, configuration variables or production data changes.

**Verified:** focused Gmail and registration tests: **42 passed**. Full backend suite
on MySQL: **1,160 passed in 103.93 s**. Ruff lint/format, diff checks and changed-file
pre-commit checks pass. Tests cover both failed endpoints, recognized reason formats,
malformed responses and untrusted strings without leaking sensitive content.

**Follow-up:** deploy this update, retry registration once, and inspect the new
`Gmail API delivery failed` line to identify the actual deployment configuration issue.


## 2026-10-22 · Step 7.5: Gmail delivery on Render Free

**Cause:** the reported registration 503 comes from transactional email delivery.
Render Free blocks Gmail SMTP port 587. The user confirmed the Free tier and prefers
Gmail. Render documentation confirms the SMTP restriction; production logs were not
available for direct inspection.

**Changed:** added `core.email_backend.GmailEmailBackend` using HTTPS for OAuth token
refresh and MIME message submission. Explicit backend settings now take precedence
over existing SMTP credentials. Production rejects missing Gmail OAuth credentials;
Render Blueprint and `.env.example` document the settings. Kept generic registration
503/password-reset responses and secret-free delivery failure logs. No new dependencies
or migrations. Added [[Gmail on Render Free]] with sender authorization and rollout steps.

**Verified:** focused email/settings/registration suite: **49 passed**. Full backend
suite on container MySQL: **1,154 passed in 108.67 s**. Ruff lint and formatting pass;
pre-commit checks on the changed files pass, including YAML and secret scanning.
Coverage includes OAuth refresh, MIME/OTP preservation, SMTP-setting precedence,
HTTP rejections at both endpoints, timeouts, malformed responses, missing credentials,
batch sending and Bcc. No actual emails were sent during tests.

**Files:** core email backend/tests, production/base settings, accounts mail docstrings,
Render Blueprint, example environment, [[Accounts]], [[Core]], [[Security Model]],
[[Dev Environment Setup]], [[Decisions Log]] (ADR-023), [[Roadmap]], this log.

**Rollout still required:** deploy this commit and configure the sender's Google OAuth
client ID, client secret, refresh token and Gmail address in Render. Live registration
and inbox delivery cannot be verified until the sender is authorized. Testing-mode
refresh tokens expire after seven days; follow the guide for continued operation.

## 2026-10-22 · Step 7.4: Admin logout navigation ✅

**Reproduced:** admin dashboard and settings logout tests failed to display the
dedicated sign-in form. Clearing the entire query cache disconnected mounted guards
from the current-user query. Account-menu per-call mutation callbacks could also
disappear when session cleanup unmounted the menu.

**Fixed:** the logout hook cancels pending queries, sets the observed current-user
query to null, removes other cached queries and mutation data, then replaces the
route synchronously. Super Admins return to `/admin`, members to `/`. Navigation
lives in the hook's mutation callback so it survives account-menu unmounts.

**Verification:** the added dashboard/settings regressions failed before the fix;
all five profile/logout tests now pass. Full frontend suite: **185 passed across
31 files** (208.75 s). Production build and its TypeScript checks pass. Commit hooks
enforce lint, formatting, secret checks and TypeScript on the final staged change.
Live browser login/logout from nested settings is a post-push rollout check.

**Files:** auth query hook, account menu, profile/logout tests, [[Accounts]],
[[Pages and Routes]], [[Roadmap]], this log. No backend/schema changes or packages.

## 2026-10-22 · Step 7.3: Vercel API trailing-slash routing repair

**Problem reproduced live:** the Vercel `/api/v1/health` request reached Django and
returned a 301 to `/api/v1/health/`, but the slash-terminated URL returned Vercel
`404 NOT_FOUND`. The frontend calls `/api/v1/auth/me/`, so its session guard displayed
the retry error. Direct Render health returned 200 with database status OK, and
direct anonymous session lookup returned the expected JSON 401.

**Changed:** both `vercel.json` and `frontend/vercel.json` now match
`/api/:path*/` before `/api/:path*` and preserve the slash in the Render destination.
Existing frontend route fallback and API build variables remain in place.

**Verification:** both JSON files parse and `git diff --check` passes. The live
requests above are the regression reproduction; commit hooks check the staged change.
Post-push rollout must be checked using Vercel health (200), anonymous session (401
JSON), and CSRF (200 with Secure cookie). No production accounts or records changed.

**Files:** both Vercel configurations, [[Frontend Structure]], [[Roadmap]], this log.
**Follow-up:** authenticated WebSockets, Gmail delivery and cloud Super Admin setup
remain separate deployment tasks. GitHub's existing checks/browser jobs on the previous
commit reported failures; these are not resolved or claimed as passing by this routing fix.

## 2026-10-21 · Step 7.2: Controlled audit-log deletion ✅

**User decision:** explicitly requested Delete and Clear All after the append-only
policy conflict was explained. ADR-022 and `AGENT.md` record this narrow exception.

**Implemented:** active-Super-Admin-only single/collection DELETE; current password
and reason; exact `DELETE ALL LOGS` for bulk; session CSRF; five attempts/minute/user;
atomic deletion + receipt rollback. Existing and new deletion receipts are protected
from manual deletion. Clear All covers all ordinary entries across filters. Model-level
guards and evaluation-revision immutability remain unchanged. No migrations/packages.

**UI:** row Delete and Clear All buttons, explicit irreversible-action dialogs,
disabled confirmation until complete, cancellation, server error handling, password
clearing and query refresh. Tests exercise cancellation/failures/protected receipts.

**Verified:** full fresh-MySQL backend suite **1122 passed** (138.26 s); complete
frontend suite **183 passed / 31 files** (171.40 s); production frontend bundle built.
All **6 Playwright workflows passed** together (53.9 s), including real single/bulk
deletion and protected receipts. ESLint, TypeScript, Ruff, migration check and OpenAPI
validation passed; commit hooks enforce the final staged files. Browser acceptance
caught a blank optional-confirmation rejection on single deletion; the API now accepts
it, the regression test reproduces the original 400, and bulk still requires the exact phrase.

**Data safety:** no existing development/production logs were deleted. Browser
deletion tests require the isolated E2E stack flag and loopback test URL. They remove
only throwaway test data. Live launch gates from step 7.1 remain unchanged.

**Files:** `apps/audit/` services/API/constants/tests, shared throttle configuration,
frontend audit page/API/types/dialog/tests, isolated E2E script/spec and matching vault notes.

**Commit:** `feat(audit): step 7.2 confirmed audit-log deletion` (local only).

## 2026-10-21 · Step 7.1: Pre-deployment audit and remediation ✅

**Scope:** all application modules, permission/privacy coverage, frontend build,
deployment artifacts, backups, migrations, dependency scanning, and the developer host.
See [[Deployment Readiness 2026-10-20]] for the findings and live-hosting launch gates.

**Fixed:** unsafe pending-registration cleanup/plain-text passwords/approval bypass;
OTP guess budget and SMTP-secret fallback; separate-origin CSRF/CORS and WS origins;
distinct-contributor aggregate suppression and edit ownership; historical-rating
deletion and audit deletion; draft storage; backup persistence/checksums/safety snapshots;
production health/build/worker/header configuration; missing notification migration;
schema, TypeScript, lint/format, and test-fixture defects. Added GitHub Actions checks.

**Verified:** full backend suite **1090 passed** on fresh MySQL (88.15 s), including
the new shell recovery checksum/portability regression tests; production
backend image built; production `check --deploy --fail-level WARNING` has zero issues;
read-only production-image health request **200**, login POST without CSRF **403**.
All **five Playwright browser tests passed together** (39.6 s). Local Nginx/TLS checks
passed for SPA/assets/security headers, health, CSRF, allowed hosts, cookies and redirect;
Chromium rendered the final production bundle through TLS/CSP without page errors.
SQL recovery matched source/recovery at 6 users, 1 evaluation and 35 migrations, with
a verified safety snapshot and migration check. Concurrent backups had unique names,
mode 0600 and valid checksums. OpenAPI validation, Ruff and migration drift checks passed.
Repository commit hooks cover secret scanning, whitespace/YAML/JSON/TOML, Ruff,
ESLint, Prettier and TypeScript. An earlier manual hook run noticed concurrent vault
edits; the final commit runs the hooks against the frozen staged files.

Frontend rerun completed: **179 passed / 30 files** in 166.47 s. Added author-specific
draft keys so account changes across tabs cannot load another author's draft, and
preserved the login skip link as the first tab stop. Final frontend image built.

**Dependencies:** no new application packages. Render Python updated to 3.12.15 and
production Nginx to 1.30.6 after checking upstream releases. A temporary Python audit
tool reported an unpatched Twisted IMAP advisory; the application has no IMAP server.
Production npm audit reported zero known vulnerabilities. See the review for sources.

**Files:** backend accounts/core/evaluations/feedback/members/notifications/system,
matching regression tests, frontend auth/admin/evaluation/client code, formatting
corrections, `deploy/`, `scripts/`, `.env.example`, Render config, CI, and vault notes.
No public deployment or remote write performed. No developer database reset/restore.

**Follow-ups:** production domain/TLS/SMTP/datastores, off-host backups and recovery
drill, production smoke test, monitoring, and self-evaluation policy reconciliation.
The local recovery drill used only the throwaway E2E database. Test containers/volumes
and captured mail were removed; ignored diagnostic logs and recovery archives remain.

**Commit:** `fix(deploy): step 7.1 pre-deployment readiness hardening` + tag `phase-7`.
This completes the local review, not the infrastructure-dependent live launch gates.

> [!note] Commits
> From step 1.5 on, every step is its own commit, and every completed phase gets a `phase-N` tag.
> Steps 0.1–1.4 were committed together in the repository's **initial commit**, because later steps
> had already edited earlier steps' files.

---

## 2026-10-18 · Step 6.5: Final acceptance ✅ (Phase 6 complete → tag `phase-6`)
**What:** walked through every item in [[Acceptance Checklist]] and linked automated test evidence across backend unit/service/API/permission/privacy suites, frontend component/accessibility suites, Playwright E2E specs, and production/data-management tests. Updated [[Roadmap]], [[Testing Strategy]], [[API Endpoints]], [[System Settings]], [[Accounts]], and [[Reports]].
**Commit:** `docs(acceptance): step 6.5 final acceptance and phase 6 completion` + tag `phase-6`

## 2026-10-18 · Step 6.4: Data management ✅
**What:** (1) `scripts/backup.sh` (`mysqldump --single-transaction --routines --triggers --events --set-gtid-purged=OFF` → gzipped `.sql.gz` + `.sha256` with `chmod 600` and old-backup rotation) and `scripts/restore.sh` (SHA-256 verification, optional safety snapshot, restore + `manage.py migrate --check`); (2) `audit.services.purge_expired_logs` and `evaluations.services.apply_retention` + `manage.py apply_retention` (scheduled in `worker`), purging expired evaluations in `CLOSED`/`ARCHIVED` cycles and expired audit logs while never touching `OPEN` cycles, and recording `system.retention.applied`; (3) member self-deactivation (`accounts.services.deactivate_own_account`, `POST /api/v1/auth/deactivate/`) with password confirmation, last-Super-Admin guard, session logout, and preservation of historical evaluations (`BR-06`); (4) member own-data export (`reports.selectors.own_data_export`, `reports.services.export_own_data`, `GET /api/v1/me/export/`) returning account, choir profile, evaluations given, and anonymised feedback received (`accounts.data_export.generated` audited); (5) "Your data & account" card on `/app/profile` for downloading `my-data.json` and self-deactivating; (6) `backend/apps/core/tests/test_data_management.py` + privacy-sweep and permission-matrix registration.
**Requirements:** SET-03, SET-04, NFR-07, AUTH-04, BR-06
**Docs updated:** [[System Settings]], [[Accounts]], [[Reports]], [[API Endpoints]], [[Roadmap]]
**Commit:** `feat(data): step 6.4 backups, retention, own-data export and self-deactivation`

## 2026-10-18 · Step 6.3: Production configuration ✅
**What:** hardened `backend/config/settings/prod.py` (refuses wildcard/empty `ALLOWED_HOSTS`, refuses weak/placeholder/identical `DJANGO_SECRET_KEY` and `FEEDBACK_ID_KEY`, enables `SECURE_HSTS_PRELOAD = True`, `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`, and `CONTENT_SECURITY_POLICY`); updated `PrivateApiCacheMiddleware` in `backend/apps/core/middleware.py` to emit `Content-Security-Policy` when configured; added `deploy/backend.Dockerfile`, `deploy/frontend.Dockerfile`, `deploy/nginx/default.conf` (HTTP→HTTPS redirect, TLS 1.2/1.3, HSTS, CSP, SPA fallback, `/static/`, `/api/`, `/django-admin/`, `/ws/` upgrade), and `deploy/docker-compose.prod.yml`; added `backend/apps/core/tests/test_prod_settings.py` verifying `manage.py check --deploy --fail-level WARNING` passes with 0 warnings.
**Requirements:** BR-11, NFR-06, NFR-07
**Docs updated:** [[Security Model]], [[Dev Environment Setup]], [[Roadmap]]
**Commit:** `build(deploy): step 6.3 production settings, CSP, Dockerfiles and Nginx TLS`

## 2026-10-18 · Step 6.2: Accessibility pass ✅
**What:** added `tabIndex={-1}` on `<Container component="main" id="main">` in `PublicLayout`, `MemberLayout`, and `AdminLayout` so the `Skip to content` link moves focus cleanly; enabled `flexWrap: "wrap"` in `AppHeader` and `MemberNav` so 360px viewports never overflow horizontally; added `frontend/src/app/__tests__/accessibility.test.tsx` (automated Vitest + RTL checks for skip link, landmarks, headings, and labels on every control) and `frontend/e2e/05-accessibility-and-responsive.spec.ts` (Playwright keyboard focus and 360px responsive checks).
**Requirements:** NFR-05
**Docs updated:** [[Testing Strategy]], [[Roadmap]]
**Commit:** `feat(a11y): step 6.2 accessibility pass and 360px responsive checks`

## 2026-10-18 · Step 6.1: Test & security sweep ✅
**What:** added AST-based module boundary and dependency-DAG test suite (`backend/apps/core/tests/test_module_boundaries.py`), full resolver-driven permission-matrix suite (`backend/apps/core/tests/test_permission_matrix.py`) across all public/member/admin routes × `{anonymous, pending, suspended, deactivated, owner, other_member, super_admin}`, and Playwright E2E suite (`frontend/playwright.config.ts`, `frontend/tsconfig.e2e.json`, `scripts/e2e.sh`, `docker-compose.e2e.yml`, `frontend/e2e/01-registration.spec.ts` .. `04-realtime-and-revocation.spec.ts`).
**Requirements:** BR-03, BR-04, BR-09, NFR-02, NFR-03
**Docs updated:** [[Testing Strategy]], [[Module Boundaries]], [[Roadmap]]
**Commit:** `test(security): step 6.1 permission matrix, module boundaries and Playwright e2e`

## 2026-10-18 · Step 6.0: Follow-up fixes ✅
**Context:** the user asked to "finish all pending fixes" and confirmed Q1–Q10 (commit `ce9c91d`).
**What:** (1) every admin page is a lazy route and React / MUI are long-lived vendor chunks (`build.rolldownOptions.output.
codeSplitting`): main app chunk **620 → 205 kB**, no size warning; (2) the evaluation form warns when a text contains the
writer's own name; (3) `close_expired_cycles` service + command, run every minute by the worker (with `deliver_notifications`);
both commands are now quiet when there is nothing to do.
**Verification:** backend **470 passed** (+2: only expired OPEN cycles close, idempotent, system actor in the audit row;
command output); ruff, `check`, `makemigrations --check`, `spectacular` clean. Frontend **149 passed** (+8: 7 name-matching
cases incl. accents/whole words/short names, form warning on edit and review without blocking), typecheck, ESLint, Prettier
clean; build OK. Live: worker restarted with both jobs (`-v 2`: 0 closed, 0 delivered).
**Docs updated:** [[Evaluations]], [[Privacy Model]], [[Dev Environment Setup]], [[Roadmap]]
**Commit:** `fix: step 6.0 follow-up fixes (lazy admin, own-name warning, auto-close periods)`

## 2026-10-18 · Step 5.3: Frontend realtime ✅ (Phase 5 complete → tag `phase-5`)
**What:** `lib/ws.ts` (reconnect with backoff + jitter, no retry on 4401/4403/4001, ping, resync hook);
`features/notifications` (bell with live unread badge and popover, notification center at `/app/notifications` and
`/admin/notifications`, mark read / all read, socket hook that refreshes feedback/dashboard/evaluations and re-checks the
session when revoked); polling fallback every 30 s (unread) / 60 s (admin dashboard) while sockets are down;
`useAdminLiveUpdates` for live admin counts. Bell drawn with `SvgIcon` (no icon package added).
**Requirements:** RT-01, RT-02, RT-03, RT-04, RT-05
**Verification:** typecheck, ESLint, Prettier clean; `vitest` **140 passed** on 2 consecutive runs (+14: 6 `ws.ts` tests incl.
backoff sequence 1→2→…→30 s, no retry for 3 close codes, stop() cancels a pending reconnect; 6 UI tests: unread pushed on
connect and updated live, popover list + mark all read + open link marks read and navigates, polling notice when the socket
drops, revoked socket → session re-check → /login, notification center unread filter, admin `dashboard.changed` → dashboard
refetch); build OK. Live: the dev server serves the new modules (200). Backend unchanged since 5.2 (468 passed).
**Bug found while testing:** MSW 3 strips the trailing slash from WebSocket client URLs before matching, so handlers for
`*/ws/notifications/` never matched; test links now omit it (documented in [[Testing Strategy]]).
**Not verified:** an authenticated end-to-end socket in a real browser (needs a dev account; Phase 6 E2E covers it).
**Phase 5 summary:** Channels/Daphne/Redis foundation, Docker dev stack (5.1a, user request), notification handlers with
debounced anonymous feedback notices, WebSocket consumers, and the realtime frontend.
**Docs updated:** [[Notifications]], [[Pages and Routes]], [[Testing Strategy]], [[Roadmap]], AGENT.md (standing authorization fulfilled)
**Commit:** `feat(notifications): step 5.3 frontend realtime` + tag `phase-5`

## 2026-10-18 · Step 5.2: Event handlers & consumers ✅
**What:** notification handlers for submissions (debounced / held for AFTER_CLOSE), cycle open/close, registrations,
approvals, suspensions and failed-login bursts; `PendingFeedbackNotice` + `deliver_notifications` command + compose
`worker`; best-effort after-commit WebSocket pushes; `/ws/notifications/` and `/ws/admin/` consumers. Events enriched
(`cycle_id`, `cycle_name`, `feedback_visibility`); accounts selectors `active_user_ids`, `get_active_user`, `get_user_by_pk`.
ADR-020. AGENT.md §2.3.6 wording updated to match (notifications reads `system` settings and subscribes to events).
**Requirements:** RT-01..RT-06
**Verification:** `docker compose exec backend pytest` **468 passed** (+13: 8 handler tests incl. debounce timing, one
window for two submissions, anonymity of text and push payload, AFTER_CLOSE hold/release, fan-out without suspended users,
registration + approval, failed-login alert once, suspension → `session.revoked`; 5 consumer tests through the real ASGI
stack with session cookies: anonymous 4401, foreign origin refused, live `notification.created` + ping/pong, admin socket
Super Admin only + `dashboard.changed` with empty payload, suspension closes with 4001); ruff, `check`,
`makemigrations --check`, `spectacular --validate --fail-on-warn` clean. Live: worker container running
(`deliver_notifications` → 0 due), anonymous WebSocket handshake through the Vite proxy → 403.
**Not verified live:** an authenticated socket in a browser (no dev account was created in your database; 5.3 adds the UI).
**Test notes:** consumer tests use `transaction=True, serialized_rollback=True` (the consumers read the DB from another
thread; serialized rollback restores the voice sections/settings seeded by migrations).
**Docs updated:** [[Notifications]], [[Privacy Model]], [[Module Boundaries]], [[Data Model]], [[Decisions Log]] (ADR-020),
[[API Endpoints]], [[Dev Environment Setup]], [[Roadmap]]
**Commit:** `feat(notifications): step 5.2 event handlers, delivery and websocket consumers`

## 2026-10-18 · Step 5.1a: Docker dev stack ✅ (user request: "put docker")
**What:** `backend/Dockerfile.dev` + `frontend/Dockerfile.dev` and `backend` / `frontend` services in `docker-compose.yml`
(ADR-019); Vite file-watch polling switch (`VITE_USE_POLLING`); `.env.example` host-port variables; AGENT.md commands.
**Verification (live, 2026-10-18):** `docker compose up -d --build` → mysql, redis, backend healthy, frontend up. Backend log:
"Starting ASGI/Daphne version 4.2.3", migrations applied. `GET :8010/api/v1/health/` 200; through the Vite proxy on :5280:
SPA 200, `/src/main.tsx` 200, `/api/v1/system/public/` 200, CSRF cookie set, login POST with token → 400
`invalid_credentials` (CSRF passed), without token → 403. `docker compose exec backend pytest` → **455 passed**.
**Bugs fixed during the step:** Vite failed with `EACCES` creating its cache because `npm ci` ran as root; the image now
installs as the `node` user (the fresh `frontend_node_modules` volume was recreated). One image build hit `npm ci` exit 152
(network); the retry succeeded.
**Not verified:** WebSockets end to end (no consumer until 5.2); HMR in a real browser.
**Commit:** `build(docker): step 5.1a containerised dev stack`

## 2026-10-18 · Step 5.1: Channels foundation ✅
**What:** Channels + Daphne + Redis channel layer, ASGI routing (HTTP + origin-checked, session-authenticated WebSockets),
`apps.notifications` with the `Notification` model, `notify` / `mark_read` / `mark_all_read` services and the REST API
(list, unread count, mark one / all read).
**Requirements:** RT-01, RT-05 (REST fallback), RT-06 (safe text, enforced by handlers in 5.2)
**Dependencies added:** channels 4.3.2, channels-redis 4.3.0, daphne 4.2.3, redis 6.4.0 (pip also resolved Django 6.1 as
"latest" when downloading; it was discarded, the pin stays on Django 5.2 LTS).
**Verification:** backend `pytest` **455 passed** (+11: 5 notify validation cases incl. absolute and protocol-relative links,
anonymous 401, suspended refused, own-only newest first with an explicit field set, unread count + read + read-all, another
user's notification → 404 and unchanged, ASGI app routes http + websocket); privacy sweep covers the new member routes;
`check`, `makemigrations --check`, `spectacular --validate --fail-on-warn` clean. No frontend changes.
**Docs updated:** [[Notifications]], [[Dependencies]], [[API Endpoints]], [[Roadmap]]
**Commit:** `feat(notifications): step 5.1 channels foundation and notifications API`

## 2026-10-17 · Step 4.6: Audit log viewer + System settings + Privacy page ✅ (Phase 4 complete → tag `phase-4`)
**What:** read-only audit log API + `/admin/audit` (search, event/actor/date filters, expandable before/after/details,
CSV/Excel export that is itself audited); system settings API + `/admin/settings` (general, registration, privacy floor,
privacy notice, notification debounce, retention values); public `/privacy` page with the choir's notice and a "who sees
what" table, linked from a footer on every page. `core.exports` now shared by reports and audit.
**Requirements:** AUD-03, AUD-04, SET-01, SET-03 · ADM-06
**Verification:** backend `pytest` **444 passed** (+22: permissions, read-only 405s, newest-first with actor, 5 filter cases,
actor filter + date validation, event types, export content + its own audit row, PDF refused; settings read/update with cache
invalidation + audit before/after, 5 validation cases incl. privacy floor and unknown time zone, no-op update writes nothing);
privacy sweep updated with the `audit-admin` and `system-admin` namespaces (its completeness check would otherwise fail);
`check`, `makemigrations --check`, `spectacular --validate --fail-on-warn` clean. Frontend typecheck + lint clean, `vitest`
**126 passed** (+5), build OK.
**Not done here:** a live browser/HTTP smoke run of Phase 4 (all checks above go through Django's full middleware stack in
tests on MySQL, but nothing was clicked through in a real browser).
**Phase 4 summary:** dashboard, members & roles, periods/criteria/forms, evaluations browser + moderation with identity-access
auditing, reports & exports, audit log, settings, privacy page.
**Docs updated:** [[Audit]], [[System Settings]], [[Module Boundaries]], [[API Endpoints]], [[Pages and Routes]], [[Roadmap]]
**Commit:** `feat(admin): step 4.6 audit log, settings and privacy page` + tag `phase-4`

## 2026-10-17 · Step 4.5: Reports & exports ✅
**What:** admin reports: choir summary (filters: period, voice section, criterion, dates), member summary, participation per
member; exports as CSV / Excel / PDF (evaluator-detail export CSV/Excel from the evaluations browser). Every export is audited
synchronously; formula injection neutralised; filenames without names; 60/hour throttle. ADR-018 (openpyxl + reportlab).
**Requirements:** REP-01..06, ADM-07, BR-15
**Verification:** backend `pytest` **422 passed** (+25: permissions, choir aggregates with hidden evaluations excluded, not-rated
≠ zero, criterion/section/period suppression, filters + date validation, member summary, participation numbers, CSV content +
audit metadata + filename, XLSX identities + no formula cells, PDF participation/member, 5 export validation cases with no audit
row, `safe_text` cases, empty choir); `check`, `makemigrations --check`, `spectacular --validate --fail-on-warn` clean. A sample PDF
was rendered to PNG and inspected (escaped markup, accents, landscape table). Frontend typecheck + lint clean, `vitest`
**121 passed** (+4), build OK. The lazy reports chunk also brought the main bundle from 941 kB to 534 kB.
**Runner image:** wheels for openpyxl 3.1.5, reportlab 4.4.10, pillow 12.3.0 added to the throwaway test image (PyPI release
dates could not be checked from here, so known release lines were pinned: reportlab 4.4.x instead of the new 5.0).
**Docs updated:** [[Reports]], [[Decisions Log]] (ADR-018), [[Dependencies]], [[Module Boundaries]], [[API Endpoints]], [[Pages and Routes]], [[Roadmap]]
**Commit:** `feat(reports): step 4.5 reports and audited exports`

## 2026-10-17 · Step 4.4: All evaluations browser + moderation ✅
**What:** Super Admin browser of every evaluation **with its author** (filters: member about/by, period, criterion, rating range,
dates, moderation state, edited), detail with revisions incl. editor, moderation (flag / hide / restore the whole evaluation, its
comment or its suggestion, reason required) with an append-only `ModerationAction` history and a moderation queue. Every
identity-revealing read is written to the audit log as `admin.sensitive_access`. Dashboard tile "Needs moderation"; nav gains
Evaluations · Moderation.
**Requirements:** ADM-02, ADM-03, ADM-05 · BR-17
**Verification:** backend `pytest` **397 passed** (+24: permissions on all 5 endpoints, identities + audit metadata, 7 filter cases,
filter validation leaves no audit row, detail/revisions audited with editor, hide comment → gone from the recipient's feedback → restore,
hide whole evaluation, flag → queue while still visible, 4 rule violations, missing text, append-only history, dashboard count);
`check`, `makemigrations --check`, `spectacular --validate --fail-on-warn` clean; privacy sweep still green (new routes are in
`evaluations-admin`, so the members-get-403 sweep covers them automatically). Frontend typecheck + lint clean, `vitest` **117 passed**
(+5), build OK.
**Docs updated:** [[Evaluations]], [[Data Model]], [[Module Boundaries]], [[API Endpoints]], [[Pages and Routes]], [[Roadmap]]
**Commit:** `feat(admin): step 4.4 evaluations browser and moderation`

## 2026-10-17 · Step 4.3: Cycles, criteria & form management UI ✅
**What:** admin pages for evaluation periods (status-aware settings, confirmed transitions), criteria (order, active, archive, create/edit
with scale validation, labels, version history, categories) and forms (draft editor, publish with freeze warning, read-only published view,
copy to a new draft). Nav: Dashboard · Members · Periods · Criteria · Forms.
**Requirements:** EVAL-02, EVAL-03, EVAL-04, EVAL-06, CFG-01..06 (UI)
**Verification:** typecheck + lint clean; `vitest` **112 passed** on 2 consecutive runs (+13: schema mirrors the server, reorder payload,
create criterion with labels + client-side scale error, published form read-only + copy link, open-period conflict shown, locked fields for an
open period, new-period validation); build OK.
**Bugs fixed:** (1) silent submit failure in the criterion dialog (RHF numeric path segments → array; see [[Evaluations]]); (2) a form draft stayed
"dirty" after saving, so Publish stayed disabled (form reset to the saved values).
**Test infrastructure:** the dev VM was at load average 14–16 on 4 cores (other projects' containers). A run started alongside typecheck/lint
starved and timed out; runs with no concurrent work pass. Vitest now uses `maxWorkers: "50%"`; the lazy feedback page is preloaded in its test file.
**Follow-ups:** main bundle 941 kB (admin pages); lazy-load the admin area in Phase 6.
**Docs updated:** [[Evaluations]], [[Pages and Routes]], [[Testing Strategy]], [[Roadmap]]
**Commit:** `feat(admin): step 4.3 periods, criteria and forms UI`

---

## 2026-10-17 · Step 4.2: Member & role management ✅
**What:** role changes (self/last-admin guards, Django-admin access follows role), admin password-reset email, Q9 enforced for promoted members,
participation excludes Super Admins; admin member API in `members` (list/filter, detail, profile edit, approve, status + reason, role, reset,
voice sections); admin pages (members table, member page with confirmed actions, voice sections); privacy sweep covers `members-admin`.
**Requirements:** AUTH-03 (approval), AUTH-05, MEM-05, ADM-04, BR-08 (all audited)
**Verification:** backend `pytest` **373 passed** (+20) on MySQL; schema clean. Frontend `vitest` **99 passed** ×3 (+7); typecheck, lint clean.
**Docs updated:** [[Members]], [[Accounts]], [[API Endpoints]], [[Pages and Routes]], [[Open Questions]], [[Roadmap]]
**Commit:** `feat(admin): step 4.2 member and role management`

---

## 2026-10-17 · Step 4.1: Admin shell + dashboard stats ✅
**What:** admin dashboard endpoint (member counts, evaluations, cycle counts, open-period participation with an honest denominator),
admin dashboard page (KPI tiles, participation meter, period counts), admin navigation, shared `Meter` + viz tokens; the privacy sweep now
treats `reports-admin` as an admin namespace (members get 403).
**Requirements:** ADM-01, REP-04 (participation explained)
**Verification:** backend `pytest` **353 passed** (+7: counts by status excluding super admins, no open cycle, participation for ALL and
SAME_SECTION scopes, non-evaluable members, resubmissions counted once, API + 401/403, null percent when nothing is possible); schema clean.
Frontend `vitest` **92 passed** ×3; typecheck, lint, build OK.
**Fix during the step:** grouped status counts needed `.order_by()` (default model ordering would have joined the GROUP BY).
**Docs updated:** [[Reports]], [[API Endpoints]], [[Pages and Routes]], [[Roadmap]]
**Commit:** `feat(admin): step 4.1 admin dashboard`

---

## 2026-10-17 · Step 3.4: Privacy hardening sweep ✅ (Phase 3 complete → tag `phase-3`)
**What:** a resolver-driven privacy sweep over all 18 member GET endpoints plus completeness, admin-closure, Django-admin/docs,
error-message, cache-header and log checks; frontend audit. Fixes: no `editor` field on member revisions; `Cache-Control: no-store` on the API.
Report: [[Privacy Review 2026-10-17]].
**Requirements:** NFR-02, FB-05, BR-03, BR-04, Privacy Model §1–§14
**Verification:** backend `pytest` **346 passed** (+10 sweep tests) on MySQL; frontend `vitest` **89 passed**; schema, ruff, typecheck, lint clean.
**Docs updated:** [[Privacy Model]], [[Privacy Review 2026-10-17]], [[Testing Strategy]], [[API Endpoints]], [[API Conventions]], [[Roadmap]]
**Commit:** `feat(privacy): step 3.4 privacy hardening sweep` + tag `phase-3`
**Follow-ups:** a UI warning when an author's comment contains their own name.

---

## 2026-10-17 · Step 3.3 (part 2 of 2): Feedback I Received page ✅ (step 3.3 complete)
**What:** `features/feedback` page with anonymity banner, period filter row, stat tiles + meters, threshold messages, trend line + table
twin, comment list with date filters, nav item and dashboard tile; lazy-loaded route. Tests for the edit flow and history (part 1) were added too.
**Requirements:** FB-01..06 (UI), MINE-02/04/06 (UI), REP-02, REP-04, REP-06 (UI), NFR-05
**Verification:** typecheck + lint clean · `vitest` **89 passed** on 3 consecutive runs (+14: banner, tiles/meters, suppression, trend table,
plain-text comments, period + date filters, empty state, nav; edit → review → PATCH payload with change summary → revision 2 in history,
cancel, closed window, private history note, `describeChanges`), no warnings · `build` OK: main 865 kB + FeedbackPage chunk 366 kB.
**Dataviz:** palette validated (PASS light/dark on the real surfaces); the chart was rendered to PNG in both modes and inspected (gap for a suppressed
period, ringed markers, endpoint label, hairline grid); x-axis padding added after the visual check.
**Dependencies added:** recharts 3.10.1, react-is 19.3.1.
**Docs updated:** [[Feedback]], [[Evaluations]], [[Pages and Routes]], [[Dependencies]], [[Roadmap]]
**Commit:** `feat(feedback): step 3.3 feedback page, edit and history tests`

---

## 2026-10-17 · Step 3.3 (part 1 of 2): edit flow + revision history 🚧
**What:** shared `EvaluationForm` (create/edit modes, optional change summary on review), edit panel on My Evaluation detail
(only when `can_edit`; uses the cycle's frozen form), `RevisionHistory` (author-only timeline, per-revision changes, full snapshot in
`<details>`), PATCH and revisions hooks. Added recharts 3.10.1 + react-is 19.3.1 (for part 2). Chart colors validated with the dataviz
validator: #2a78d6 on #ffffff and #3987e5 on #121212 both PASS.
**Verification:** typecheck + lint clean; `vitest` 75 passed (the existing evaluate tests still pass after the refactor).
**Pending (part 2):** the Feedback I Received page (anonymity banner, stat tiles + meters, trend line + table twin, comment list with
filters), nav and dashboard links, new tests (edit flow, history, feedback page), docs.
**Commit:** `feat(evaluations): step 3.3 part 1 edit flow and revision history`

---

## 2026-10-17 · Step 3.2: Feedback module (backend) ✅
**What:** `apps/feedback` anonymised read model: whitelisted row selectors in evaluations, opaque HMAC feedback IDs, day-precision dates,
time-neutral ordering, moderation and visibility rules, threshold-protected per-criterion aggregates and per-cycle trend, list, summary
and count API, dashboard `feedback_received`.
**Requirements:** FB-01..05, MINE-05, MINE-06, REP-02, REP-04, REP-06; BR-03, BR-06, BR-15, BR-16
**Verification (MySQL):** `pytest` **336 passed** (+17 feedback / privacy tests listed in [[Feedback]]) · schema clean · ruff, check, makemigrations clean.
A test-data bug (percent values on a 1–5 criterion) was caught by the server's validation and fixed in the test.
**Docs updated:** [[Feedback]], [[API Endpoints]], [[Open Questions]], [[Roadmap]]
**Commit:** `feat(feedback): step 3.2 anonymised feedback module`

---

## 2026-10-17 · Step 3.1: Editing & revisions (backend) ✅
**What:** `edit_evaluation` (author-only, edit window, validation against the original form version, row lock, no-op for identical
content, revision n+1, audited event with IDs only), moderation carry-over on rewrite, PATCH + revisions API.
**Requirements:** MINE-02, MINE-03, MINE-04, MINE-05 (history hidden from recipient), MINE-07, BR-05, BR-07, AUD-05
**Verification (MySQL):** `pytest` **319 passed** (+13: revision n+1 keeps the original, no-op, sequential numbers, recipient/other → 404,
deadline and closed-cycle 409, deadline after end allowed, original-form validation after a criterion re-version, moderation kept,
validation, PATCH API, 409 + `can_edit` false, revisions author-only) · schema `--fail-on-warn` clean · ruff, check, makemigrations clean.
**Docs updated:** [[Evaluations]], [[API Endpoints]], [[Module Boundaries]], [[Open Questions]], [[Roadmap]]
**Commit:** `feat(evaluations): step 3.1 editing and revisions`

---

## 2026-10-17 · Step 2.4: Evaluate & My Evaluations (frontend) ✅ (Phase 2 complete → tag `phase-2`)
**What:** evaluate page (eligibility, dynamic Zod schema from the form, accessible `RatingInput`, counters, review step with
`PrivacyNotice` and focus management, success), my evaluations list and detail, profile "Evaluate" link, nav item, dashboard
cycle-progress card, nested server field errors.
**Requirements:** EVAL-01, EVAL-03/04 (UI), EVAL-05, EVAL-07 (confirmation), MINE-01 (UI), FB-06 / privacy rule (notice before
submission), NFR-04 (draft kept on failure), NFR-05
**Verification:** typecheck + lint clean · `vitest` **75 passed** on 3 consecutive runs (+11: criteria render with accessible groups,
required validation, review + privacy notice + focus + exact payload, server field errors keep the draft, 409 on review, ineligible
message + link, list / empty / detail as text (no HTML) / 404, dashboard progress, profile CTA) · `build` OK.
**Live contract check** (disposable DB, seed_demo_data --members 3 --open-cycle): login → current cycle → 6-criteria form →
eligibility → submit with the UI's payload **201** (labels snapshotted) → duplicate **409** → eligibility `ALREADY_EVALUATED` →
mine 1 → dashboard progress → recipient's "mine" **0**; DB: 1 revision. The DB was dropped afterwards.
**Fixes during the step:** duplicate accessible group name on ratings (inner group now "<criterion> rating"); `useWatch` instead of
`watch` (React Compiler lint); focus-based review instead of `scrollTo`.
**Docs updated:** [[Evaluations]], [[Pages and Routes]], [[Roadmap]]
**Commit:** `feat(evaluations): step 2.4 evaluate and my evaluations UI` + tag `phase-2`
**Follow-ups:** bundle 859 kB (code splitting, Phase 6).

---

## 2026-10-17 · Step 2.3: Evaluation submission (backend) ✅
**What:** evaluation, rating, comment and append-only revision models; shared eligibility rules; `submit_evaluation`
(server-chosen open cycle, combined validation, text cleaning, revision 1, audited event); member API (current cycle,
cycle form, eligibility, submit with throttle, my evaluations list and detail); public settings endpoint (privacy notice);
dashboard cycle progress; `services` became a package.
**Requirements:** EVAL-01, EVAL-05, EVAL-07 (server side), EVAL-08, MINE-01, MINE-03 (revision 1), MEM-04, SET-03;
BR-01 (service + DB check), BR-02, BR-05, BR-10, BR-12, BR-13, BR-14, BR-15 (NULL, not zero)
**Verification (MySQL):** `pytest` **306 passed** (+32: happy path incl. labels / optional NULL / comments / revision / audit,
immutable revisions, text cleaning, self-evaluation in service and DB, once-per-cycle + resubmission numbering, window
not started / ended, inactive → 404, not-evaluable, same-section scope, super admin refused, required + scale + unknown/duplicate
+ length validation, API 201/400/409/401, recipient can't see 'mine', throttling, public settings, dashboard progress).
The OpenAPI schema validates with `--fail-on-warn` (enum names fixed). Dev DB migrated.
**Fixes during the step:** rating and text errors are now reported together (previously the rating errors hid the comment error).
**Docs updated:** [[Evaluations]], [[System Settings]], [[Reports]], [[API Endpoints]], [[Module Boundaries]], [[Open Questions]], [[Roadmap]]
**Commit:** `feat(evaluations): step 2.3 evaluation submission`

---

## 2026-10-17 · Step 2.2: Evaluation configuration (backend) ✅
**What:** `apps/evaluations` configuration: categories, criteria with immutable versions, form versions (draft →
published, frozen), cycles (DRAFT → OPEN → CLOSED → ARCHIVED, one open cycle at DB level), scale validation, Super Admin
API under `/api/v1/admin/`, read-only Django admin, `seed_demo_data` command (the dev DB was seeded: 6 criteria, form v1, draft "Demo cycle").
**Requirements:** EVAL-02, EVAL-03, EVAL-04, EVAL-06, CFG-01..06; BR-07, BR-13 (cycle window prerequisites), BR-18
**Verification (MySQL):** `pytest` **274 passed** (+60: scale rules, versioning and immutability, publish freezing current
versions, published-form locks, sequential form numbers, cycle lifecycle and per-status locks, single open cycle at service **and DB**
level, date and form validation, admin API 401/403/201/409/404, decimals as JSON numbers, seed idempotency) · ruff clean ·
`check` / `makemigrations --check` clean · dev DB migrated and seeded twice (idempotent).
**Decisions:** ADR-017.
**Docs updated:** [[Evaluations]], [[Data Model]], [[API Endpoints]], [[API Conventions]], [[Module Boundaries]], [[Backend Structure]], [[Decisions Log]], [[Roadmap]]
**Commit:** `feat(evaluations): step 2.2 evaluation configuration`
**Follow-ups:** cycle auto-close job (later); configuration UI is step 4.3.

---

## 2026-10-17 · Step 2.1: Member directory ✅
**What:** backend directory (django-filter search + voice section, ACTIVE only, ordered, paginated, no N+1),
member detail (404 for inactive), own profile bio, `apps/reports` with `GET /dashboard/`. Frontend: directory page
(URL-synced filters and pagination), member profile page (bio editor for self), dashboard page, main navigation with `aria-current`.
**Requirements:** MEM-01, MEM-02, MEM-03, AUTH-04 (bio); NFR-03 (pagination, query cap), NFR-05
**Verification:** backend `pytest` **214 passed** on MySQL (+20: directory filters, privacy of fields, pagination,
query count, detail 404s, bio update + audit, dashboard) · ruff clean · `check` / `makemigrations --check` clean.
Frontend: typecheck + lint clean, `vitest` **64 passed** on 3 consecutive runs (+11).
**Fixes during the step:** a URL update during render was moved into an effect; a timing-sensitive test was fixed with a 3s async timeout (stable over 3 runs);
the member list got an accessible name because the pagination also renders a list.
**Dependencies added:** django-filter 26.2.
**Docs updated:** [[Members]], [[Reports]], [[API Endpoints]], [[Pages and Routes]], [[Dependencies]], [[Testing Strategy]], [[Roadmap]]
**Commit:** `feat(members): step 2.1 member directory`

---

## 2026-10-17 · Step 1.6: Frontend auth pages ✅ (Phase 1 complete → tag `phase-1`)
**What:** login, registration (voice sections, mode-specific result), forgot password, reset password, email
verification (explicit confirm), profile (names + password change), account menu with logout (clears the cache),
safe post-login redirects, RHF + Zod schemas, server-error → field mapping, shared form components.
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04 (UI); NFR-05 (labels, alerts with roles, keyboard-usable toggles)
**Verification:** `typecheck`, `lint` (0 warnings), `format:check` clean · `vitest` **53 passed** (+25), no React/MUI
warnings · `build` OK (782 kB / 246 kB gzip; code splitting noted for Phase 6). Request bodies were checked by hand against
the backend serializers (login, register, reset, confirm, verify, me PATCH, password-change).
**Dependencies added:** react-hook-form 7.90.0, zod 4.6.7, @hookform/resolvers 5.9.2.
**Docs updated:** [[Frontend Structure]], [[Pages and Routes]], [[Dependencies]], [[Roadmap]]
**Commit:** `feat(frontend): step 1.6 auth pages` + tag `phase-1`
**Follow-ups:** UI flows were verified in jsdom, not in a real browser (Playwright e2e is step 6.1).

---

## 2026-10-17 · Step 1.5: Frontend skeleton ✅
**What:** `frontend/`: Vite 8 + React 19 + TypeScript 6.0 (strict, `@/` alias), ESLint 10 flat config
(strictTypeChecked + react-hooks + react-refresh + prettier, with lint-enforced no-`dangerouslySetInnerHTML`,
feature-index-only imports and axios-only-in-apiClient), Prettier, MUI 9 theme (light/dark), React Router 8
route tree (public / guest-only / member / super admin) with layouts and guards, TanStack Query client
(no 4xx retries), axios `apiClient` (CSRF header, `ApiError` normalisation, `ensureCsrfCookie`), `useCurrentUser`,
Welcome page with live API status, not-found and route-error pages, skip link. Tests use Vitest + RTL + MSW 3.
Pre-commit runs frontend eslint, prettier and typecheck.
**Requirements:** NFR-05 (skip link, labelled spinner, responsive layout), NFR-06, BR-09 (guards are UX only), BR-10 (XSS lint rule)
**Verification:**
- `npm run typecheck`, `npm run lint` (0 warnings), `npm run format:check`: clean
- `npm run test`: **28 passed** (apiClient envelope/network/CSRF header, retry policy, fetchCurrentUser, Welcome + API status, all guard redirects, retryable session error, 404, skip link). No React/MUI warnings in the output.
- `npm run build`: OK (1 chunk, 560 kB / 180 kB gzip; size warning noted as a follow-up)
- **Live proxy check** (Django on :8010 in the runner container against the dev DB, Vite on :5280): app shell
  served with our title; `/src/main.tsx` served as JS; deep links fall back to index.html; `/api/v1/health/` through the
  proxy → 200 `{"status":"ok","db":"ok"}` + `X-Request-ID`; CSRF cookie set via the proxy; same-origin POST passes the CSRF origin
  check (generic 400); foreign `Origin` → 403; anonymous `/me` → 401. Both servers were stopped afterwards.
- Backend suite re-run after the `FRONTEND_URL` default change: **194 passed**.
**Incident:** ports 8000/5173/5180 belong to other local projects. A first check hit another app and was
discarded (my stray `npx vite` was stopped). The dev ports moved to 8010/5280 (ADR-016).
**Dependencies added:** see [[Dependencies]] (frontend table). Forms libraries moved to 1.6.
**Docs updated:** [[Frontend Structure]], [[Tech Stack]], [[Dependencies]], [[Dev Environment Setup]], [[Decisions Log]], [[Roadmap]], AGENT.md, README
**Commit:** see `git log` (`feat(frontend): step 1.5 frontend skeleton`)
**Follow-ups:** route-level code splitting (Phase 6). The real browser render was covered by jsdom tests, not checked visually.

---

## 2026-10-17 · Step 1.4: Accounts + registration ✅
**What:**
- `apps/accounts`: custom `User` (public_id, email/username unique, role, status-derived
  `is_active`, approval fields), `UserManager`, email-or-username backend with timing
  equalisation, reset and verification tokens, plain-text emails. Services: `create_user`
  (all 4 registration modes), `create_super_admin`, `authenticate_and_login`, `logout`,
  `change_password`, `request_password_reset` / `confirm_password_reset`, `verify_email`,
  `update_own_profile`, `approve_user`, `set_user_status` (no self-change, last-super-admin guard).
  API: csrf, login, logout, me (GET/PATCH), password-change, password-reset (+confirm), verify-email.
  Login and reset throttles. Read-only Django admin with audited actions. `create_super_admin` command.
- `apps/members` (minimal): `VoiceSection` (seeded), `MemberProfile`, `register_member` (atomic), and the
  register and voice-sections API with `RegisterThrottle`.
- `core`: `enforce_csrf`, `ClientIPThrottle`, OpenAPI session-cookie extension. Settings:
  `AUTH_USER_MODEL`, Argon2 first, password validators (min 10), 2h link lifetime, throttle rates,
  `NUM_PROXIES` (no spoofable X-Forwarded-For).
- Tests: factories (`UserFactory` with traits, `SuperAdminFactory`, `MemberProfileFactory`) and
  conftest fixtures (`member`, `super_admin`, `member_client`, `admin_client_api`, `registration_mode`).
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04 (names), AUTH-05 (services), AUTH-06, BR-08, BR-09, BR-10
**Verification (MySQL 8.4, runner container):**
- `manage.py check` no issues · `makemigrations --check` no changes · ruff clean
- `pytest`: **194 passed** (+89). Done-when covered: each registration mode (OPEN/APPROVAL/EMAIL_VERIFICATION/CLOSED,
  service + API), identical generic login errors for wrong password / unknown / pending / suspended /
  deactivated, pending and suspended blocked (a suspended user's live session → 401), throttles
  (login 6th → 429 and other identifiers unaffected; register 4th → 429; reset 4th → 429), audit rows for every event.
- **First `migrate` of the dev DB** `choir_eval` (accounts.0001 applied before admin/audit/system).
- **Live HTTP smoke test** on a disposable DB (dropped afterwards): csrf → voice sections → register (PENDING) →
  login refused → approve → login by email (case-insensitive) → me → PATCH (role change ignored) → logout → 401;
  login without CSRF → 403. Audit had all 6 event types with the client IP.
**Dependencies added:** `argon2-cffi==25.1.0`.
**Docs updated:** [[Accounts]], [[Members]], [[API Endpoints]], [[API Conventions]], [[Security Model]],
[[Backend Structure]], [[Data Model]], [[Dependencies]], [[Open Questions]], [[Roadmap]]
**Follow-ups:** create your own Super Admin with `create_super_admin` (see AGENT.md §12). The local venv
still needs `mysqlclient` for `runserver` from your own shell. The frontend login must re-read
`csrftoken` after login (token rotation), noted for step 1.6.

---

## 2026-10-17 · Step 1.3: System + Audit foundations ✅
**What:**
- `apps/system`: `SystemSettings` singleton (seeded by migration, second instance refused,
  delete blocked), `RegistrationMode`, cached `get_settings` / `get_public_settings`, and
  `update_settings` (whitelist, type coercion, `full_clean`, row lock, cache invalidated on
  commit, `SettingsChanged` event). The Django admin goes through the service.
- `apps/audit`: append-only `AuditLog` (`actor` PROTECT, request context, indexes),
  `record()` with recursive secret redaction, and `record_domain_event` subscribed to every
  `DomainEvent` (registered in `AuditConfig.ready`). The Django admin view is read-only.
- `core`: `DomainEvent` envelope (`actor_id`, `target_id`, `target_type`, `audited`);
  `request_context()` helper. `conftest.py`: autouse cache clearing and an `actor` fixture.
**Requirements:** SET-01, SET-03 (public fields), AUD-01..03, AUD-02 (no secrets), BR-08
**Files:** `backend/apps/system/**`, `backend/apps/audit/**`, `backend/apps/core/{events,middleware}.py`,
`backend/config/settings/base.py`, `backend/conftest.py`, `backend/pyproject.toml`
**Verification (MySQL 8.4, throwaway runner container; local venv still lacks mysqlclient):**
`manage.py check` no issues · `makemigrations --check` no changes · `pytest` **105 passed**
(64 core + 41 system/audit) · ruff clean. Done-when met: the append-only tests pass, a second
`get_settings()` call runs **0 queries**, and a published event creates an `AuditLog` row only after commit.
**Bug caught by tests:** saving a second `SystemSettings` instance overwrote row 1 and nulled
`created_at`. Fixed by refusing the second instance and seeding the row in a data migration.
**Dependencies added:** none.
**Decisions:** ADR-013 (aggregate floor ≥ 3), ADR-014 (generic auditing via the event envelope).
**Docs updated:** [[System Settings]], [[Audit]], [[Core]], [[Module Boundaries]], [[Data Model]], [[Decisions Log]], [[Open Questions]], [[Roadmap]]
**Follow-ups:** step 1.4 switches `AUTH_USER_MODEL` to `accounts.User`. The `system` and `audit`
migrations use `swappable_dependency`, so they follow automatically on a fresh DB. 1.4 needs the
local `mysqlclient` install for `migrate`/`runserver`.

---

## 2026-10-17 · Step 1.2: Backend skeleton + core ✅
**What:** Django 5.2 project `backend/config/` with split settings (`base/dev/test/prod`),
django-environ reading the repo-root `.env`, MySQL `DATABASES` (utf8mb4, strict `sql_mode`,
utf8mb4 test DB; these options apply only to the MySQL engine), DRF defaults (session auth, `IsActiveMember`, pagination,
JSON only, error handler), drf-spectacular (`/api/schema/`, `/api/docs/`: open in dev,
super-admin-only elsewhere), Django admin at `/django-admin/`, ASGI/WSGI entry points.
`apps/core`: `TimeStampedModel`, `PublicIdModel`, `AppendOnlyModel` (+ queryset guards),
event bus, domain errors + exception handler (envelope), 401-capable `SessionAuthentication`,
`IsActiveMember`/`IsSuperAdmin`, `DefaultPagination`, `RequestContextMiddleware`,
`GET /api/v1/health/`, `assert_no_evaluator_leak`. `pyproject.toml` holds the ruff + pytest config.
**Requirements:** NFR-03 (pagination), NFR-06, NFR-08 (health), BR-09 (default permission), PRIV test helper
**Files:** `backend/manage.py`, `backend/pyproject.toml`, `backend/conftest.py`, `backend/requirements/*.txt`,
`backend/config/**`, `backend/apps/core/**`
**Verification so far:**
- `ruff check .` / `ruff format --check .`: clean (39 files)
- **Temporary SQLite smoke run** (scratch DB, not the official run): `manage.py check` no issues;
  `pytest`: **64 passed**; `runserver`: `/api/v1/health/` 200 `{"status":"ok","db":"ok"}` + `X-Request-ID`,
  `/api/docs/` 200, `/api/schema/` 200. The schema test caught a duplicate-enum warning, now fixed with `ENUM_NAME_OVERRIDES`.
- `check --deploy` (prod settings): only `security.W021` (HSTS preload), deliberately left for step 6.3.
- ✅ **Official MySQL run (ADR-011)** against the compose MySQL 8.4 server. The host still lacks
  `default-libmysqlclient-dev`, so it ran in a throwaway `python:3.12-slim` container on the
  `choir-eval_default` network (repo mounted read-only, packages installed offline from host-downloaded
  wheels; the mysqlclient sdist was SHA-256-verified against PyPI):
  `mysqlclient 2.3.0 | django 5.2.18`, `manage.py check` no issues,
  `makemigrations --check` no changes, `pytest` **64 passed**.
**Dependencies added:** Django 5.2.18, djangorestframework 3.18.3, django-environ 0.14.0,
drf-spectacular 0.30.0, mysqlclient 2.3.0 (pinned, not yet installed), pytest 9.1.1,
pytest-django 4.14.0, factory-boy 3.3.3, ruff 0.17.1.
**Decisions:** ADR-012 (409 for business-rule violations).
**Docs updated:** [[Core]], [[Backend Structure]], [[API Conventions]], [[API Endpoints]], [[Dependencies]], [[Decisions Log]], [[Roadmap]]
**Follow-ups:** ⚠️ do **not** run `migrate` on the dev DB before step 1.4 (custom user model).
The **local** venv still needs `mysqlclient` before step 1.4 (local `runserver`/`migrate`):
`sudo apt-get install -y default-libmysqlclient-dev pkg-config` →
`backend/.venv/bin/pip install -r backend/requirements/dev.txt`.

---

## 2026-10-17 · Step 1.1: Repository scaffolding ✅
**What:** initialised git (`main`, nothing committed yet). Added `.gitignore`, `.editorconfig`,
`.env.example` (every env var, placeholder secrets), a local `.env` with generated dev
secrets (git-ignored, mode 600), `docker-compose.yml` (MySQL 8.4 + Redis 7.4 with
healthchecks, named volumes, bound to 127.0.0.1:3307/6380), `docker/mysql/conf.d/choir.cnf`,
`docker/mysql/init/01-test-db-grants.sh`, `.pre-commit-config.yaml`, `README.md`, and the
`backend/` and `frontend/` folders.
**Requirements:** BR-11 (no secrets in git), NFR-06
**Files:** `.gitignore`, `.editorconfig`, `.env.example`, `docker-compose.yml`, `docker/mysql/**`,
`.pre-commit-config.yaml`, `README.md`, `backend/requirements/dev.txt`, `frontend/.gitkeep`
**Verification:**
- `docker compose up -d mysql redis`: both containers `(healthy)`
- MySQL as the app user: `utf8mb4 / utf8mb4_unicode_ci`, `+00:00`, strict `sql_mode`;
  `CONVERT_TZ(..., 'UTC', 'Asia/Tokyo')` works (tz tables loaded); `CREATE/DROP DATABASE test_choir_eval` OK;
  the app user cannot read the `mysql` system schema (least privilege ✔)
- `redis-cli ping` → `PONG`
- `pre-commit run --all-files`: all hooks pass (end-of-file-fixer fixed `Source Requirements.md`)
- gitleaks probe: a staged fake GitHub token was **blocked** (`github-pat`), and the probe was removed
- `git ls-files`: `.env` and `backend/.venv` are not tracked
**Dependencies added:** `pre-commit==4.7.0` (backend/.venv). Hook revs were set with
`pre-commit autoupdate`. Images `mysql:8.4`, `redis:7.4-alpine`.
**Docs updated:** `AGENT.md` (tree + commands), [[Dev Environment Setup]], [[Dependencies]], [[Roadmap]]
**Follow-ups:** the initial git commit is pending your go-ahead. Next step is **1.2 Backend skeleton + core**
(needs `sudo apt-get install -y default-libmysqlclient-dev pkg-config`; python3-dev and build-essential are already installed).

---

## 2026-10-17 · Step 0.1: Documentation & Rules ✅
**What:** Read the specification `Choir_Member_Evaluation_System_Modules_and_Functionalities.docx`.
Created this Obsidian vault (`docs/`), `AGENT.md` (all project rules, modular-monolith
file structure) and `CLAUDE.md` (imports AGENT.md).
**Files:** `AGENT.md`, `CLAUDE.md`, `docs/**`
**Verification:** every section of [[Source Requirements]] (§1–§13) maps to a vault note:
§1 → [[System Overview]], §2 → [[Roles and Permissions]], §3 → [[Functional Requirements]] + module notes,
§4/§5 → [[Tech Stack]]/[[Dependencies]], §6 → [[Data Model]], §7 → [[Business Rules]],
§8 → [[Pages and Routes]], §9 → [[Non-Functional Requirements]], §10 → [[Backend Structure]]/[[Frontend Structure]],
§11 → [[Roadmap]], §12 → [[Acceptance Checklist]], §13 → [[Open Questions]].
**Dependencies added:** none.
**Follow-ups:** confirm the [[Open Questions]] (proposed defaults are in place); next step is **1.1**.
