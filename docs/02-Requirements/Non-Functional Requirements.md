---
tags: [requirements, nfr]
---
# Non-Functional Requirements

| ID | Area | Requirement | How we meet it |
|---|---|---|---|
| NFR-01 | Security | Role-based permissions, secure password hashing, input validation, CSRF, rate limiting, least-privilege DB access. | [[Security Model]] |
| NFR-02 | Privacy | No evaluator identity leakage through UI, APIs, notifications, exports, URLs or logs available to members. | [[Privacy Model]] + privacy test suite |
| NFR-03 | Performance | Paginate long lists, index common filters, never load all evaluations at once. | DRF pagination everywhere, DB indexes, `select_related`, query-count tests |
| NFR-04 | Reliability | Handle reconnects for real-time features; preserve saved submissions if the connection drops. | WS backoff + polling fallback; form drafts kept in local state until 2xx; idempotent submit |
| NFR-05 | Accessibility | Keyboard navigation, readable contrast, clear validation messages, responsive (phones + computers). | MUI + WCAG AA, labelled inputs, Playwright/axe checks in Phase 6 |
| NFR-06 | Maintainability | Django apps by responsibility, reusable React components, documented APIs, automated tests. | [[Module Boundaries]], drf-spectacular OpenAPI, [[Testing Strategy]] |
| NFR-07 | Backup & recovery | Scheduled DB backups, protected backup files, periodic restore tests. | `scripts/backup.sh`, `scripts/restore.sh`, Phase 6 |
| NFR-08 | Observability | Structured logs without sensitive data; health endpoint. | `/api/v1/health/`, logging config in settings |

Related: [[Functional Requirements]] · [[Acceptance Checklist]]
