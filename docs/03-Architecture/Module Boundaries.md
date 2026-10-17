---
tags: [architecture, rules]
---
# Module Boundaries

The authoritative rules are in `AGENT.md` §2.3. This note explains them and lists the
**event catalog**.

## Allowed imports
```
apps.<other>.selectors     ✅ read
apps.<other>.services      ✅ write
apps.<other>.events        ✅ event classes
apps.<other>.constants     ✅ enums
apps.<other>.models        ⚠️ only to declare a ForeignKey / type hints
apps.<other>.api.*         ❌ never
apps.<other>.handlers      ❌ never
```

The one direct-call exception: `apps.audit.services.record(...)` may be called directly
when the audit entry must be written **inside the same transaction** or for **read-access
logging** (e.g. a super admin viewing identities), because a read has no event.

A lightweight check, to be added in Phase 6 (e.g. `import-linter` or a pytest that scans
imports), will enforce these rules in CI.

## Domain event catalog
Events are frozen dataclasses (subclasses of `core.events.DomainEvent`) in the publishing
module's `events.py`. Every event has the envelope `actor_id`, `target_type`, `target_id`.
Payloads carry **IDs only**, never personal content (comments, names, emails).
Consumers re-query what they need. One exception: configuration events may carry
`changes = ((field, before, after), ...)` because configuration values are not personal data (ADR-014).
**Audit records every event automatically** (it subscribes to `DomainEvent`). Set
`audited = False` on purely technical events.

| Event | Publisher | Consumers | Payload |
|---|---|---|---|
| `accounts.user.registered` | accounts | audit, notifications (admins: approval needed) | user_id |
| `accounts.user.logged_in` | accounts | audit | user_id |
| `accounts.user.login_failed` | accounts | audit (+ unusual-activity check) | identifier_hash, ip |
| `accounts.user.status_changed` | accounts | audit | user_id, before, after, actor_id |
| `accounts.user.role_changed` | accounts | audit | user_id, before, after, actor_id |
| `accounts.password.reset_requested` | accounts | audit | user_id |
| `evaluations.cycle.opened` / `.closed` | evaluations | audit, notifications (members) | cycle_id, actor_id |
| `evaluations.criterion.changed` | evaluations | audit | criterion_id, version, actor_id |
| `evaluations.form.published` | evaluations | audit | form_version_id, actor_id |
| `evaluations.evaluation.submitted` | evaluations | audit, notifications (recipient, debounced) | evaluation_id, recipient_id, cycle_id |
| `evaluations.evaluation.edited` | evaluations | audit, notifications (author) | evaluation_id, revision_number |
| `evaluations.evaluation.moderated` | evaluations | audit | evaluation_id, action, actor_id |
| `reports.export.generated` | reports | audit | report_type, filters, actor_id |
| `system.settings.changed` ✅ | system | audit | actor_id, target_id=1, changes |

> [!warning] Notification handlers must not leak
> `notifications.handlers` turns `evaluation.submitted` into a generic "You have new
> feedback" message for the **recipient**. They must never include `evaluator_id` in
> the notification or WS payload. See [[Privacy Model]].

Related: [[Architecture Overview]] · [[Backend Structure]]
