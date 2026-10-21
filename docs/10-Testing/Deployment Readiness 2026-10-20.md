---
tags: [testing, deployment, security]
---
# Deployment readiness review · 20–21 October 2026

Subsequent user-approved change: step 7.2 / ADR-022 adds password/reason-confirmed
Super Admin audit deletion and typed Clear All with retained deletion receipts.
That narrowly supersedes this review's original removal of manual deletion. See
[[Audit]] and [[Progress Log]] for current behavior and verification; the original
test counts below describe the completed step 7.1 snapshot.

## Decision

The original checkout was **not ready to deploy**. Its checked roadmap did not match the
current code: the baseline had 215 backend failures, two frontend failures, a failing
TypeScript build, lint/format errors, and an uncommitted notification-model migration.
This review repairs those defects and records fresh evidence below. No public service
has been deployed, and the developer database has not been restored or reset.

Current assessment: the repaired application passes local readiness checks and can
proceed to staging validation. Live launch is still conditional on the hosting,
operational and product-policy gates below; passing tests is not a public deployment.

## Changes

| Area | Defect and resulting behavior |
|---|---|
| Registration | Removed destructive cleanup of existing unverified accounts. Pending registration stores a password hash and a fresh challenge nonce in expiring shared cache; there is no unbounded process-local fallback. Email confirmation respects admin approval. |
| OTP and email | Five guesses per challenge/user state across clients. Verification is single-use. SMTP failures return a generic error and never print OTP/reset secrets as a fallback. Delivery completes before reporting success. |
| Browser/API security | CSRF endpoint and login return a masked token for separate-origin deployments; login rotation updates the client token. CORS permits the registration header only for configured origins and varies cached responses by Origin. WebSocket origins use the explicit trusted-origin list. |
| Feedback privacy | Resubmissions by one evaluator cannot satisfy a group threshold. Trends exclude criterion/cycle buckets with too few distinct contributors, including missing-rating cases. Ownership is checked before validating edit payloads, preserving generic 404 responses. |
| History | Criteria and categories are archived on removal. Historical ratings and published forms survive. Arbitrary audit-log deletion is unavailable. Retention preserves the current evaluation revision. |
| Drafts | Drafts use tab-scoped session storage and are cleared on login, logout, or an expired session; legacy persistent drafts are also removed on account changes. |
| Backups | Persistent production backup volume; unique filenames; private permissions; download auditing; checksum verification bound to the supplied archive even after moving hosts; bounded archive expansion; safety snapshot before restore; rollback on failure; rejection of attempts to rewrite existing immutable history. Executable SQL scripts and correct target-database migration checks. JSON recovery merges records and does not remove newer rows; SQL recovery is the full recovery mechanism. |
| Production | Correct Render requirements path and health URL, shared Redis required, worker configuration, current Python/Nginx release pins, correct container health hostname, worker health-check override, secret-free Docker build context, security headers retained on SPA/assets/static responses. |
| Quality | Complete permission matrix, corrected API schema, repaired TypeScript/MUI types, deterministic test isolation, notification migration, and GitHub Actions for checks and browser flows. |

## Verification

Final results are recorded in [[Progress Log]]. Local diagnostic logs are kept under
the ignored `.readiness/` directory. Browser tests use a separate Compose project
(`choir-eval-e2e`), database, ports, and file-based email sink; they never send real mail.

- Backend: **1,090 tests passed on fresh MySQL** (88.15 s), including privacy,
  permissions and recovery-path regressions. OpenAPI validation, lint/format,
  migration drift and production-settings checks passed.
- Frontend: ESLint, TypeScript, production bundle, formatting, and Vitest.
- Repository checks: whitespace/config validation, secret scanning, Ruff, ESLint,
  Prettier and TypeScript are enforced by the final commit hooks.
- Completed frontend rerun: **179 tests passed across 30 files** (166.47 s), with
  author-scoped drafts, cross-origin CSRF and initial keyboard-focus coverage.
- Browser: OTP registration and approval, peer submission and anonymity, moderation,
  realtime cycle notifications, keyboard navigation, and 360px layout.
  **All five Chromium tests passed together in 39.6 s.** Login no longer steals initial
  keyboard focus from the skip link; the responsive check opens/closes the mobile drawer.
- Infrastructure: production image builds, production Django deployment checks, and
  isolated Nginx/TLS smoke checks passed. TLS smoke uses a local self-signed certificate,
  loopback-only ports, and the production configuration with only listen ports and
  the upstream address adapted. SPA/assets retain CSP/HSTS/frame/content-type headers;
  API health is 200, a login without CSRF is 403, an invalid API host is 400, the CSRF
  cookie is Secure, and HTTP redirects to HTTPS. This does not validate a public certificate.
  A Chromium smoke check also rendered the final production login bundle through
  Nginx/TLS with CSP enabled, no page errors, and correct initial keyboard focus.
- SQL recovery: restored the isolated database into `readiness_recovery`, with a
  checksummed pre-restore snapshot and successful migration verification. Source and
  restored database both contained **6 users, 1 evaluation and 35 migrations**.
  Concurrent backups created separate files in the same second, all mode `0600`,
  with valid checksums. Encryption/off-host storage still needs a real hosting drill.
  Only throwaway containers, test volumes and captured test mail were removed afterward;
  diagnostic logs and recovery archives remain ignored under `.readiness/`.
- Dependency audit: npm production dependencies reported zero known vulnerabilities.
  Python scanning found **CVE-2026-106454 / GHSA-8pqf-f4m5-798g** in Twisted's IMAP wildcard
  handling. The application does not import or serve IMAP; Daphne uses HTTP/WebSockets.
  This is an exposure assessment, not a claim that the package is vulnerability-free.
  Track the upstream advisory and rerun dependency scanning before each release:
  [Twisted advisory](https://github.com/advisories/GHSA-8pqf-f4m5-798g).

## Launch gates requiring the actual hosting environment

1. Select the deployment target and final domain. Prefer the supplied same-origin
   Docker/Nginx deployment. Separate Vercel/Render origins need configured API/WS URLs,
   CORS and CSRF origins, and browser cookie verification. Use domains under the same
   site when possible; unrelated hosting domains can encounter third-party cookie blocking.
2. Configure independent strong secrets (`DJANGO_SECRET_KEY` ≥ 50 characters,
   `FEEDBACK_ID_KEY` ≥ 32), explicit allowed hosts, HTTPS frontend URL, database, Redis,
   and working SMTP. The development `.env` is not a production configuration.
3. Install a valid certificate and automated renewal for Nginx; keep MySQL, Redis,
   and the backend private. Run `check --deploy --fail-level WARNING` using the actual
   production configuration. Restrict the database account and network access.
4. Schedule encrypted off-host SQL backups; restore one into a separate recovery
   database before inviting members. Choose backup retention and monitor job failures.
   A backup stored on the same disk as the server is not disaster recovery.
5. Create the real Super Admin securely and perform a live smoke test: real email,
   login/logout, session cookies/CSRF, evaluation and anonymous feedback, exports,
   notification delivery, and worker operation. Do not seed demo members in production.
6. Reconcile the existing **public self-evaluation** feature with the older BR-01/spec
   notes that prohibit evaluating oneself. The current code/tests deliberately allow
   public self-reflections and exclude them from anonymous peer feedback. This review
   preserves that existing feature; product documentation/policy needs an explicit final decision.

## Deployment procedure

On the chosen server, prepare `.env` from `.env.example` using production values,
and place `fullchain.pem` and `privkey.pem` in the directory named by `TLS_CERTS_DIR`.
Generate each secret separately with `python3 -c 'import secrets; print(secrets.token_urlsafe(50))'`.

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env build
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec backend \
  python manage.py check --deploy --fail-level WARNING
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec backend \
  python manage.py create_super_admin --email you@your-choir.org --username admin \
  --first-name Your --last-name Name
docker compose -f deploy/docker-compose.prod.yml --env-file .env ps
```

Keep `MYSQL_PASSWORD` URL-safe when Compose constructs `DATABASE_URL`, or supply a properly
percent-encoded connection URL in a customized deployment. Back up before upgrading;
retain the prior images and a tested database recovery point.

For SQL backups of the production Compose project, set
`BACKUP_COMPOSE_FILE=deploy/docker-compose.prod.yml` in the server environment file and
pass a **host** output directory explicitly to `scripts/backup.sh`. `BACKUP_DIR` used
by the backend is a path **inside** the container.
Keep each archive together with its `.sha256` sidecar when moving it off-host.
For recovery into a separate schema, give the verification database user access to
that schema before running `scripts/restore.sh archive.sql.gz recovery_database`.
Use a separate recovery server/database for drills, not the live production database.

Render's Blueprint includes a web service, worker, and persistent backup disk; it
requires externally configured MySQL, Redis, SMTP, and production domains. These
resources incur hosting charges when deployed. Environment-variable references and
disk requirements follow the [Render Blueprint specification](https://render.com/docs/blueprint-spec).

## Suggestions

- Configure uptime alerts, worker/log monitoring, disk-space alerts, and certificate expiry alerts.
- Enable MFA at the hosting provider; consider a dedicated MFA feature for Super Admin accounts.
- Consider a durable transactional-email outbox for automatic SMTP retries and reduced
  password-reset timing differences. Reset responses remain generic during SMTP outages.
- Use a staging environment for future releases and schedule restore drills and dependency updates.
- Confirm the choir's display time zone (currently configurable; Asia/Manila may fit local use).
- The inspected developer host has four CPUs and about 3.7 GiB RAM, with several unrelated
  applications running. Test/build sequentially when memory is tight. Size production
  from measured usage and monitor capacity before increasing traffic.
- Bubblewrap is already installed on the inspected host (`bwrap --version`: 0.9.0).

Related: [[Acceptance Checklist]] · [[Testing Strategy]] · [[Roadmap]] · [[Security Model]]

Release sources checked during review: [Python 3.12 releases](https://www.python.org/downloads/source/)
and [Nginx stable releases](https://nginx.org/en/download.html). Application CI is configured;
it has not been run on GitHub because this review does not publish repository changes.
