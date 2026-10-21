---
tags: [testing]
---
# Testing Strategy

## Pyramid
| Level | Tools | What |
|---|---|---|
| Unit / service | pytest, pytest-django, factory-boy | business rules (BR-*), validation, versioning |
| API | DRF `APIClient` | status codes, envelopes, pagination, filters |
| Permission matrix | parametrised pytest | every endpoint × {anonymous, pending, suspended, member, other member, super admin} |
| **Privacy** | `assert_no_evaluator_leak` | every member-facing endpoint touching evaluations/notifications |
| Frontend component | Vitest + RTL + user-event + MSW | forms, validation messages, guards, empty states |
| E2E | Playwright | OTP registration → approval → anonymous peer feedback → audited moderation; live cycle closure |
| Accessibility | Playwright + RTL | skip-link keyboard focus, labelled controls, landmarks, 360px layout and mobile navigation |

## Conventions
- Location: `backend/apps/<module>/tests/`, `frontend/src/features/<f>/__tests__/`.
- Put requirement IDs in docstrings: `"""BR-01: members cannot evaluate themselves."""`
- Factories: `UserFactory`, `MemberFactory`, `SuperAdminFactory`, `CycleFactory(open=True)`, `EvaluationFactory`.
- DB: MySQL from docker-compose. The test DB is created by pytest-django (the DB user needs `CREATE` on `test_*`).
- Query counts: `django_assert_max_num_queries` on list endpoints.
- Fake credentials in tests: keep each one on a **single line** ending with
  `# gitleaks:allow (fake test password)`; use a constant if the line gets long. Never allowlist whole directories.
- Frontend: Testing Library `asyncUtilTimeout` is 5s, Vitest `testTimeout` 15s and `maxWorkers: 1` (jsdom + MUI starve when every core
  runs a worker; the dev VM has 4 cores and is shared with other projects' containers). Lazy routes are preloaded in `beforeAll` in their tests.
  Name lists and regions (`aria-label`) so queries stay unambiguous.
- Shared fixtures (`backend/conftest.py`): `api_client`, `csrf_api_client`, `member`, `super_admin`, `actor`,
  `member_client`, `admin_client_api`, `registration_mode(mode)`. The cache is cleared around every test.

## Privacy assertion helper (`apps/core/testing/privacy.py`)
```python
def assert_no_evaluator_leak(payload, *evaluators):
    """PRIV: fail if any identifying attribute of any evaluator appears anywhere in the payload."""
    blob = json.dumps(payload, default=str).lower()
    for ev in evaluators:
        for needle in {str(ev.pk), str(ev.public_id), ev.username, ev.email,
                       ev.first_name, ev.last_name, ev.display_name}:
            if needle and len(str(needle)) > 2:
                assert str(needle).lower() not in blob, f"evaluator leak: {needle!r}"
```
Use names that are unlikely to collide (factories generate unique tokens) so the check
stays strict without false positives. Integer PKs are additionally checked by key
(`evaluator`, `evaluator_id`, `author`, `editor`) because small numbers collide easily.

## Privacy sweep
`apps/feedback/tests/test_privacy_sweep.py`: register every new member endpoint in `_requests()` (or `WRITE_ONLY`), otherwise the completeness test fails. See [[Privacy Review 2026-10-17]].

## Must-have test list (minimum)
- [x] Business-rule service coverage; BR-01's older prohibition conflicts with the existing public self-reflection feature and requires the launch policy decision in [[Deployment Readiness 2026-10-20]].
- [x] Every `/admin/` endpoint returns 403 for members and 401 for anonymous users (`apps/core/tests/test_permission_matrix.py`)
- [x] Privacy test on: feedback list/summary/count, dashboard, notifications list + WS messages, member directory/profile, own data export (`apps/feedback/tests/test_privacy_sweep.py`, `apps/core/tests/test_data_management.py`)
- [x] Append-only: AuditLog, EvaluationRevision, ModerationAction (`apps/core/tests/test_models.py`, `apps/evaluations/tests/test_moderation.py`)
- [x] Thresholds: suppression with n=0,1,2 and display at n=3 (`apps/feedback/tests/test_feedback.py`, `test_contributor_privacy.py`)
- [x] Averages exclude missing ratings (`apps/feedback/tests/test_feedback.py`, `test_contributor_privacy.py`)
- [x] Module boundary & dependency DAG enforcement (`apps/core/tests/test_module_boundaries.py`)
- [x] Accessibility & 360px responsive layout (`frontend/src/app/__tests__/accessibility.test.tsx`, `frontend/e2e/05-accessibility-and-responsive.spec.ts`)

## Commands
```bash
cd backend && pytest                     # all backend unit/API/permission/privacy/boundary/prod tests
pytest apps/evaluations -k privacy       # subset
cd frontend && npm run test              # Vitest + RTL component & accessibility tests
# From the repository root:
./scripts/e2e.sh                         # isolated Playwright stack, removed on exit
```
## WebSockets
- Backend: consumers are tested through `config.asgi.application` with `channels.testing.WebsocketCommunicator`, a real
  session cookie and an `Origin` header; mark them `django_db(transaction=True, serialized_rollback=True)`. Create cookies
  *before* entering async code (session creation is synchronous ORM work).
  Use a fresh test database for final verification (`pytest --create-db`): transactional
  socket tests can flush data-migration seeds, so `--reuse-db` alone is not sufficient.
- Frontend: every socket the app opens must have an MSW `ws.link` handler (`onUnhandledFrame: "error"`); link patterns
  have no trailing slash. Push frames with `link.broadcast(...)` or per-test `connection` listeners; keep REST stubs
  consistent with what the socket says, because invalidations refetch over REST.
