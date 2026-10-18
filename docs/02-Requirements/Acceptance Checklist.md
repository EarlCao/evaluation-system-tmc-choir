---
tags: [requirements, acceptance]
---
# Acceptance Checklist

The system is "done" when every item is checked **and verified by an automated test or a
documented manual check**. Link the evidence in [[Progress Log]].

- [x] New members can register and securely log in. (AUTH-01, AUTH-02 — verified in `backend/apps/accounts/tests/test_accounts.py`, `frontend/src/features/auth/pages/__tests__/authPages.test.tsx`, `frontend/e2e/01-registration.spec.ts`)
- [x] Members can evaluate other members using the configured rating form. (EVAL-01..08 — verified in `backend/apps/evaluations/tests/test_submissions.py`, `frontend/src/features/evaluations/__tests__/evaluate.test.tsx`, `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Members can see received ratings, comments, suggestions and evaluation counts **without evaluator names**. (FB-01..06 — verified in `backend/apps/feedback/tests/test_feedback.py`, `backend/apps/feedback/tests/test_privacy_sweep.py`, `frontend/src/features/feedback/__tests__/feedback.test.tsx`, `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Members can see and edit **only their own** submissions within the allowed time window. (MINE-01..07 — verified in `backend/apps/evaluations/tests/test_revisions.py`, `backend/apps/core/tests/test_permission_matrix.py`, `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Every edit preserves a revision with the editor and timestamp. (MINE-03, MINE-04 — verified in `backend/apps/evaluations/tests/test_revisions.py`, `frontend/src/features/evaluations/__tests__/editAndRevisions.test.tsx`, `frontend/e2e/02-evaluation-and-feedback.spec.ts`)
- [x] Super Admin can view evaluator identities, configure criteria/scales, manage members, inspect logs and generate reports. (ADM-01..07 — verified in `backend/apps/evaluations/tests/test_moderation.py`, `backend/apps/reports/tests/test_reports.py`, `backend/apps/audit/tests/test_audit_api.py`, `frontend/e2e/03-admin-and-moderation.spec.ts`)
- [x] Real-time updates work and reconnect gracefully after a network interruption. (RT-01..05 — verified in `backend/apps/notifications/tests/test_consumers.py`, `frontend/src/lib/__tests__/ws.test.ts`, `frontend/src/features/notifications/__tests__/notifications.test.tsx`, `frontend/e2e/04-realtime-and-revocation.spec.ts`)
- [x] Automated tests confirm ordinary users cannot access admin-only endpoints or infer evaluator identities. (BR-03, BR-04, NFR-02 — verified in `backend/apps/feedback/tests/test_privacy_sweep.py`, `backend/apps/core/tests/test_permission_matrix.py`, `backend/apps/core/tests/test_module_boundaries.py`, `frontend/e2e/03-admin-and-moderation.spec.ts`)
- [x] Production config uses env vars, HTTPS, restricted CORS, secure cookies and protected backups. (BR-11, NFR-07 — verified in `backend/config/settings/prod.py`, `backend/apps/core/tests/test_prod_settings.py`, `backend/apps/core/tests/test_data_management.py`, `deploy/`, `scripts/backup.sh`, `scripts/restore.sh`)

Related: [[Functional Requirements]] · [[Testing Strategy]] · [[Roadmap]]

