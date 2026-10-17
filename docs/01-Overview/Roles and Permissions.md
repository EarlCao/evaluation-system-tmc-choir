---
tags: [overview, security]
---
# Roles and Permissions

Roles are stored on `accounts.User.role`. Account **status** is separate
(`PENDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`). Only `ACTIVE` users can use the app.

| Role | Access | Restrictions |
|---|---|---|
| **MEMBER** (User / Choir Member) | Create and manage own account; evaluate other members; view feedback received; view own submitted evaluations; edit own submissions; review edit history of own submissions. | Cannot see evaluator names for feedback received by them or by others. No admin tools. Cannot see another user's private submission history. |
| **SUPER_ADMIN** (God Mode) | Full access to members, evaluations, comments, suggestions, rating configuration, reports, audit logs, evaluation settings and system administration. | Every privileged action is audit-logged. Sensitive data is visible only to authorised Super Admin accounts. |

## Permission matrix

| Capability | Anonymous | Member (ACTIVE) | Member (PENDING/SUSPENDED/DEACTIVATED) | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Register / login / reset password | ✅ | – | login blocked with a neutral message | ✅ |
| View / update own profile | ❌ | ✅ | ❌ | ✅ |
| Member directory | ❌ | ✅ (basic fields) | ❌ | ✅ (all fields) |
| Evaluate another member | ❌ | ✅ (eligible, cycle open, not self) | ❌ | ❌ by default ([[Open Questions]]) |
| View own submitted evaluations + revisions | ❌ | ✅ | ❌ | ✅ (all) |
| Edit own evaluation | ❌ | ✅ (within edit window) | ❌ | ❌ (moderates instead) |
| View feedback received (anonymised) | ❌ | ✅ | ❌ | ✅ |
| See evaluator identities | ❌ | ❌ **never** | ❌ | ✅ (audit-logged) |
| Manage users / roles / status | ❌ | ❌ | ❌ | ✅ |
| Manage cycles, criteria, form settings | ❌ | ❌ | ❌ | ✅ |
| Moderate feedback | ❌ | ❌ | ❌ | ✅ |
| Reports & exports | ❌ | own summary only | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ✅ (read + export, no edit/delete) |
| System settings | ❌ | read privacy notice | ❌ | ✅ |

## Enforcement
- DRF permission classes in `apps/core/permissions.py`: `IsActiveMember`, `IsSuperAdmin`.
- Object-level checks (e.g. "is this my evaluation?") live in **services and selectors**,
  not in the UI. See [[Security Model]].
- Frontend route guards (`app/guards/`) are UX only, **not** security.

Related: [[Accounts]], [[Privacy Model]], [[Business Rules]]
