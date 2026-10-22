---
tags: [requirements, frontend]
---
# Pages and Routes

Frontend routes (React Router). The **Guard** column is UX only. The API enforces access.

| Page | Route | Guard | Feature folder | Phase |
|---|---|---|---|---|
| Public / Welcome | `/` | public | `features/auth` | 1 ✅ |
| Login | `/login` | guest | `features/auth` | 1 ✅ |
| Register | `/register` | guest | `features/auth` | 1 ✅ |
| Forgot / Reset Password | `/forgot-password` (guest), `/reset-password/:uid/:token` (public) | guest / public | `features/auth` | 1 ✅ |
| Verify Email | `/verify-email/:uid/:token` | public | `features/auth` | 1 ✅ |
| Profile | `/app/profile` | member | `features/auth` | 1 ✅ |
| Member Dashboard | `/app` | member | `features/dashboard` | 2 ✅ |
| Choir Member Directory | `/app/members` | member | `features/members` | 2 ✅ |
| Member Profile | `/app/members/:publicId` | member | `features/members` | 2 ✅ |
| Evaluate a Member | `/app/members/:publicId/evaluate` | member | `features/evaluations` | 2 ✅ |
| My Submitted Evaluations | `/app/my-evaluations` | member | `features/evaluations` | 2 ✅ |
| Evaluation Details & Revision History | `/app/my-evaluations/:publicId` | member (author only) | `features/evaluations` | 2–3 ✅ |
| Feedback I Received | `/app/feedback` (lazy chunk) | member | `features/feedback` | 3 ✅ |
| Notifications | `/app/notifications`, `/admin/notifications` (+ header bell on every signed-in page) | member, super admin | `features/notifications` | 5 ✅ |
| Privacy Notice | `/privacy` (also on the evaluate review step; linked from the footer of the member and admin areas, not the sign-in pages) | public | `features/auth` | 2 / 4 ✅ |
| Super Admin Dashboard | `/admin` | super admin | `features/admin` | 4 ✅ |
| Manage Members & Roles | `/admin/members`, `/admin/members/:publicId`, `/admin/voice-sections` | super admin | `features/admin` | 4 ✅ |
| Manage Evaluation Cycles | `/admin/cycles`, `/admin/cycles/new`, `/admin/cycles/:publicId` | super admin | `features/admin` | 4 ✅ |
| Manage Rating Criteria & Form Settings | `/admin/criteria`, `/admin/forms`, `/admin/forms/new`, `/admin/forms/:publicId` | super admin | `features/admin` | 4 ✅ |
| All Evaluations | `/admin/evaluations`, `/admin/evaluations/:publicId` | super admin | `features/admin` | 4 ✅ |
| Moderation Queue | `/admin/moderation` | super admin | `features/admin` | 4 ✅ |
| Reports & Analytics | `/admin/reports` (`?view=participation`), `/admin/reports/members/:publicId` | super admin | `features/reports` (lazy) | 4 ✅ |
| Audit Logs | `/admin/audit` | super admin | `features/admin` | 4 ✅ |
| System Settings & Privacy Policy | `/admin/settings` | super admin | `features/admin` | 4 ✅ |

> [!note] Django admin
> Django's built-in admin is mounted at a non-default path (`/django-admin/`), restricted
> to `SUPER_ADMIN` + `is_staff`, and intended for emergencies only. Day-to-day admin work
> uses the React admin screens, which are audited.

Related: [[Frontend Structure]] · [[API Endpoints]]

Logout replaces the current route with `/admin` for Super Admins (showing their
dedicated login form) or `/` for members. This applies from nested pages as well as
the dashboards and clears the previous user's cached server data.
