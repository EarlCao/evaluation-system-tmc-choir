---
tags: [requirements, acceptance]
---
# Acceptance Checklist

The system is "done" when every item is checked **and verified by an automated test or a
documented manual check**. Link the evidence in [[Progress Log]].

- [ ] New members can register and securely log in. (AUTH-01, AUTH-02)
- [ ] Members can evaluate other members using the configured rating form. (EVAL-01..08)
- [ ] Members can see received ratings, comments, suggestions and evaluation counts **without evaluator names**. (FB-01..06)
- [ ] Members can see and edit **only their own** submissions within the allowed time window. (MINE-01..07)
- [ ] Every edit preserves a revision with the editor and timestamp. (MINE-03, MINE-04)
- [ ] Super Admin can view evaluator identities, configure criteria/scales, manage members, inspect logs and generate reports. (ADM-01..07)
- [ ] Real-time updates work and reconnect gracefully after a network interruption. (RT-01..05)
- [ ] Automated tests confirm ordinary users cannot access admin-only endpoints or infer evaluator identities. (BR-03, BR-04, NFR-02)
- [ ] Production config uses env vars, HTTPS, restricted CORS, secure cookies and protected backups. (BR-11, NFR-07)

Related: [[Functional Requirements]] · [[Testing Strategy]] · [[Roadmap]]
