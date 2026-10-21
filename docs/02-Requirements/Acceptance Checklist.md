---
tags: [requirements, acceptance]
---
# Acceptance Checklist

The system is "done" when every item is checked **and verified by an automated test or a
documented manual check**. Link the evidence in [[Progress Log]].

- [x] New members can register and securely log in. (AUTH-01, AUTH-02 — `backend/apps/accounts/tests/test_api.py`, `test_registration_security.py`; `frontend/src/features/auth/__tests__/RegisterPage.test.tsx`, `LoginPage.test.tsx`; `frontend/e2e/01-registration.spec.ts`)
- [x] Members can evaluate other members using the configured rating form. (EVAL-01..08 — `backend/apps/evaluations/tests/test_submission.py`, `test_submission_races.py`; `frontend/src/features/evaluations/__tests__/EvaluateMemberPage.test.tsx`; `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Members can see received ratings, comments, suggestions and evaluation counts **without evaluator names**. (FB-01..06 — `backend/apps/feedback/tests/test_feedback.py`, `test_privacy_sweep.py`, `test_contributor_privacy.py`; `frontend/src/features/feedback/__tests__/FeedbackPage.test.tsx`; `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Members can see and edit **only their own** submissions within the allowed time window. (MINE-01..07 — `backend/apps/evaluations/tests/test_editing.py`; `backend/apps/core/tests/test_permission_matrix.py`; `frontend/src/features/evaluations/__tests__/EditAndHistory.test.tsx`)
- [x] Every edit preserves a revision with the editor and timestamp. (MINE-03, MINE-04 — `backend/apps/evaluations/tests/test_editing.py`; `frontend/src/features/evaluations/__tests__/EditAndHistory.test.tsx`)
- [x] Super Admin can view evaluator identities, configure criteria/scales, manage members, inspect logs and generate reports. (ADM-01..07 — `backend/apps/evaluations/tests/test_admin_api.py`, `test_moderation.py`; `backend/apps/members/tests/test_admin_members.py`; `backend/apps/reports/tests/test_admin_reports.py`; `backend/apps/audit/tests/test_admin_api.py`; `frontend/e2e/03-admin-moderation.spec.ts`)
- [x] Real-time updates work and reconnect gracefully after a network interruption. (RT-01..05 — `backend/apps/notifications/tests/test_consumers.py`; `frontend/src/lib/__tests__/ws.test.ts`; `frontend/src/features/notifications/__tests__/Notifications.test.tsx`; `frontend/e2e/04-realtime.spec.ts` covers live cycle closure, while unit tests cover reconnection)
- [x] Automated tests confirm ordinary users cannot access admin-only endpoints or infer evaluator identities. (BR-03, BR-04, NFR-02 — `backend/apps/feedback/tests/test_privacy_sweep.py`; `backend/apps/core/tests/test_permission_matrix.py`, `test_module_boundaries.py`)
- [x] Production config uses env vars, HTTPS, restricted CORS, secure cookies and protected backups. (BR-11, NFR-07 — verified in `backend/config/settings/prod.py`, `backend/apps/core/tests/test_prod_settings.py`, `backend/apps/core/tests/test_data_management.py`, `deploy/`, `scripts/backup.sh`, `scripts/restore.sh`)

These checks describe application behavior, not approval to launch on an unconfigured
server. See [[Deployment Readiness 2026-10-20]] and [[Progress Log]] for fresh results,
hosting gates, and the unresolved self-evaluation policy conflict with BR-01.

Related: [[Functional Requirements]] · [[Testing Strategy]] · [[Roadmap]]
