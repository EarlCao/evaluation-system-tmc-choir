---
tags: [source, requirements]
source: Choir_Member_Evaluation_System_Modules_and_Functionalities.docx
---
> [!info] Source of truth
> Faithful transcription of the original specification. Original file:
> `99-Source/Choir_Member_Evaluation_System_Modules_and_Functionalities.docx`.
> Do not edit the requirements here. Record clarifications in [[Open Questions]] / [[Decisions Log]].

# CHOIR MEMBER EVALUATION SYSTEM

Modules, Functionalities, Technical Stack, and System Requirements

Purpose: Provide a private, organized, and constructive way for choir members to evaluate one another, share comments and suggestions, and review feedback while protecting evaluator identities from ordinary users.

## 1. System Overview

The Choir Member Evaluation System is a web-based application for a choir group. Every registered member can evaluate other members using administrator-configured ratings, written comments, and suggestions. A member can view the feedback received and the number of evaluations received, but cannot see the names of the members who submitted those evaluations. The Super Admin has full system access, including the ability to view evaluator identities, manage the system, inspect audit logs, and generate reports.

Important privacy rule: evaluator names are hidden from evaluated members and ordinary users, but are visible to the Super Admin. The system must clearly explain this rule to users before they submit an evaluation.

## 2. User Roles and Permissions

| Role | Access | Restrictions |
|---|---|---|
| User / Choir Member | Create and manage own account; evaluate other members; view feedback received; view own submitted evaluations; edit own submissions; review edit history for own submissions. | Cannot see evaluator names for feedback received by them or others; cannot access admin tools or another user's private submission history. |
| Super Admin (God Mode) | Full access to members, evaluations, comments, suggestions, rating configuration, reports, audit logs, evaluation settings, and system administration. | All privileged actions should be recorded in audit logs. Sensitive data should only be accessible to authorized Super Admin accounts. |

## 3. Modules and Functionalities

### 3.1 Authentication and Account Management

- Member registration with name, email or username, password, and required choir profile details.
- Login, logout, password reset, and secure password storage.
- Email verification or Super Admin approval can be enabled to prevent unauthorized registrations.
- Profile page for viewing and updating permitted personal information.
- Super Admin can activate, deactivate, or suspend accounts and reset access when necessary.
- Role-based access control (RBAC) separates ordinary members from Super Admin.

### 3.2 Member Directory

- Display the active choir member list with basic profile information.
- Search and filter members by name, voice section, status, or other configured fields.
- Open a member profile to submit an evaluation or view feedback that the logged-in member is authorized to see.
- Prevent members from evaluating themselves.
- Allow the Super Admin to manage member details and account status.

### 3.3 Evaluation Form and Rating Criteria

- Members can evaluate other eligible choir members through a structured form.
- Super Admin can create, rename, reorder, enable, disable, and archive rating criteria (for example: attendance, preparation, teamwork, discipline, vocal performance, and participation).
- Each criterion can use a configurable scale, such as 1–5 stars/points or 0–100 percent.
- Support rating labels and descriptions, such as 1 = Needs Improvement and 5 = Excellent.
- Include written comments and constructive suggestions, with optional required fields and character limits.
- Support a configurable evaluation period or cycle, such as a rehearsal month, concert preparation, or semester.
- Validate submissions and show a confirmation before saving.
- Prevent duplicate submissions for the same evaluator, member, criterion set, and evaluation cycle unless resubmission is allowed by the Super Admin.

### 3.4 Anonymous Feedback for Members

- Members can view the ratings, comments, and suggestions they have received.
- Hide evaluator names, usernames, profile photos, and other identifying details from the evaluated member.
- Show the number of evaluations received and, where enabled, rating summaries and trends.
- Allow members to filter feedback by evaluation cycle, rating criterion, or date without revealing evaluator identity.
- Do not show evaluator identity through page URLs, API responses, downloadable reports, notifications, or browser-visible metadata.
- Clearly distinguish feedback that is anonymous to members from feedback whose identity is visible to the Super Admin.

### 3.5 My Submitted Evaluations and Editing

- Members can view the evaluations, comments, and suggestions they personally submitted.
- Allow the author to edit their own evaluation while the evaluation period is open or according to Super Admin settings.
- Save an immutable version history whenever a submission is created or edited.
- Show the original content, edited content, date/time of each change, and the account that made the change to the authorized author and Super Admin.
- An evaluated member should not see who authored or edited the feedback; they only see the latest approved/current feedback content.
- Optionally show a label such as Edited when feedback has changed, without revealing the editor to the recipient.
- Do not allow ordinary users to edit another member's submission.

### 3.6 Super Admin Dashboard — God Mode

- View system-wide statistics: registered members, active members, evaluations submitted, evaluations received, participation rate, and evaluation-cycle status.
- Browse all evaluations, ratings, comments, suggestions, evaluator identities, recipients, timestamps, and edit histories.
- Search, filter, and sort records by member, evaluator, criterion, cycle, date, rating, or status.
- Manage users, roles, evaluation periods, rating criteria, form settings, and system-wide policies.
- Moderate or flag inappropriate feedback according to a documented policy, while retaining the original record and moderation history.
- View system activity and important events through audit logs.
- Export authorized reports to CSV or Excel, and print or export summary reports to PDF.

### 3.7 Rating and Evaluation Configuration

- Create custom rating criteria and categories.
- Choose the scale type per criterion: numeric 1–5, percentage 0–100, or another supported scale configured by the system.
- Set minimum and maximum values, step size, labels, descriptions, and whether a criterion is required.
- Configure whether written comments and suggestions are optional or required.
- Configure who can evaluate whom, evaluation deadlines, editing deadlines, and whether resubmission is permitted.
- Version rating-form settings so historical evaluations retain the scale and criteria that were active when they were submitted.

### 3.8 Reports and Analytics

- Generate individual member summaries, choir-wide summaries, criterion averages, and evaluation participation reports.
- Display counts of received evaluations and aggregate rating trends over time.
- Allow filtering by evaluation cycle, date range, member, voice section, and criterion.
- Provide clear explanations for averages and percentages; do not treat missing ratings as zero.
- Restrict reports containing evaluator identities to the Super Admin.
- Use privacy thresholds or suppress very small group breakdowns where a report could indirectly reveal who submitted feedback.

### 3.9 Audit Logs and Version History

- Record security-sensitive events: login activity, failed login attempts, account and role changes, evaluation creation/editing, rating configuration changes, exports, moderation, and admin access to sensitive records.
- Each log entry should include actor account, action, affected record, timestamp, and relevant before/after values where appropriate.
- Make audit logs read-only to ordinary members and prevent routine deletion or alteration by users.
- Allow Super Admin to search and filter logs and export them for authorized review.
- Keep evaluation version history separate from general audit logs so content edits can be reviewed clearly.

### 3.10 Real-Time Updates and Notifications

- Use WebSockets for real-time dashboard counts, new feedback availability, evaluation status, and admin activity updates.
- Notify a member when new feedback is available, without identifying the evaluator.
- Notify a member when an evaluation period opens or closes and when their own submitted evaluation has been edited, where appropriate.
- Notify Super Admin about key events such as unusual activity, new registrations requiring approval, or evaluation-cycle completion.
- Provide a fallback refresh/polling strategy if a WebSocket connection is temporarily unavailable.
- Do not include private evaluator details in push, email, or in-app notifications sent to ordinary members.

### 3.11 Settings, Privacy, and Data Management

- Configure system name, choir information, time zone, evaluation policies, and notification preferences.
- Set retention rules for evaluation records, version history, and audit logs.
- Provide a privacy notice describing who can see feedback and who can see evaluator identities.
- Support secure backups and tested database restoration procedures.
- Provide data export or account-deactivation workflows according to the choir's policy.
- Use soft deletion or archival where appropriate so auditability is preserved.

## 4. Recommended Technology Stack

| Layer | Recommendation |
|---|---|
| Backend | Python 3.12+ and Django 5.x (use a currently supported compatible release); Django REST Framework for REST APIs. |
| Frontend | React with Vite, JavaScript or TypeScript, and React Router for navigation. |
| Database | MySQL 8.x using Django's MySQL database backend and a supported MySQL driver such as mysqlclient. |
| Real-time features | Django Channels with WebSockets and a Redis channel layer. Use Redis for channel messaging and, if needed, caching. |
| Authentication | Django session authentication for a same-site web deployment, or DRF token/JWT authentication if the deployment architecture requires it. Use secure, HttpOnly cookies where applicable. |
| API and validation | Django REST Framework serializers, permissions, throttling, filtering, pagination, and schema documentation. |
| Frontend data and forms | TanStack Query for server-state caching; React Hook Form with a schema validator such as Zod for form validation. |
| UI and charts | A consistent component library such as MUI or shadcn/ui, plus Recharts for dashboards and analytics. |
| Testing | Django TestCase/pytest, pytest-django, API tests, and React Testing Library with Vitest. Add end-to-end tests with Playwright if practical. |
| Code quality | Ruff and Black for Python formatting/linting, ESLint and Prettier for frontend code, and pre-commit hooks. |
| Deployment | Docker and Docker Compose for repeatable local development; a production WSGI/ASGI server, HTTPS reverse proxy, environment-based secrets, and automated backups. |

## 5. Suggested Packages and Dependencies

Backend Python packages (confirm version compatibility during project setup):

- Django — core web framework.
- djangorestframework — REST API development.
- channels and channels-redis — WebSocket support and Redis-backed channel layer.
- mysqlclient — MySQL database driver.
- django-filter — API filtering.
- drf-spectacular — OpenAPI/Swagger API documentation.
- django-cors-headers — configure cross-origin requests only when frontend and API origins require it.
- django-environ — environment variable configuration.
- Pillow — only if profile image uploads are enabled.
- pytest, pytest-django, and factory-boy — testing and test data.
- ruff — Python linting and formatting.

Frontend packages:

- react, react-dom, and vite — application runtime and build tooling.
- react-router-dom — client-side routing.
- @tanstack/react-query — API state and cache management.
- axios or the native Fetch API — HTTP requests; choose one consistent approach.
- react-hook-form and zod — form handling and validation.
- recharts — rating and report visualizations.
- A UI component library such as @mui/material or the shadcn/ui ecosystem.
- vitest, @testing-library/react, and @testing-library/user-event — frontend testing.
- eslint and prettier — code quality and formatting.

Dependency versions should be pinned in the project's lockfiles and updated deliberately. Avoid installing every package at once; add dependencies only when the corresponding feature is implemented.

## 6. Core Data Models (Suggested)

| Model | Purpose |
|---|---|
| User / MemberProfile | Account credentials and role; display name; email; voice section; account status; timestamps. |
| EvaluationCycle | Name, description, start/end dates, status, and rules for editing and resubmission. |
| RatingCriterion | Criterion name, description, scale type, minimum/maximum/step, labels, required flag, and version. |
| Evaluation | Evaluator, recipient, cycle, submission status, created/updated timestamps, and current version. Evaluator identity must be filtered from ordinary-user API responses. |
| EvaluationRating | Evaluation, criterion version, numeric value, and optional textual label. |
| EvaluationComment | Evaluation-linked comment and/or suggestion, with validation and moderation status if used. |
| EvaluationRevision | Immutable snapshots of previous/current content, editor, timestamp, and change summary. |
| AuditLog | Actor, event type, target record, timestamp, IP/device metadata if appropriate and lawful, and change details. |
| Notification | Recipient, notification type, safe message, read status, and timestamp. |

## 7. Important Business Rules

1. Members cannot evaluate themselves.
2. Ordinary users can only create, view, and edit their own submitted evaluations, subject to cycle settings.
3. An evaluated member can see feedback content and received-evaluation counts, but never the evaluator's identity.
4. Only the Super Admin can view evaluator identities and system-wide private evaluation records.
5. Every edit creates an immutable revision; editing must not silently overwrite the previous version.
6. The evaluated member sees the current feedback content and may see that it was edited, but not the identity of the editor.
7. Rating criteria and scale versions used by historical evaluations must remain available for accurate reporting.
8. All privileged access, exports, moderation, and configuration changes must be logged.
9. Server-side permission checks are mandatory; hiding a button in React is not sufficient security.
10. Prevent cross-site scripting in comments, enforce request validation and rate limits, and protect against CSRF where cookie-based authentication is used.
11. Use HTTPS in production and never commit passwords, secret keys, database credentials, or production tokens to source control.

## 8. Suggested Main Pages

- Public / Welcome page
- Register, Login, Forgot Password
- Member Dashboard
- Choir Member Directory
- Evaluate a Member
- My Submitted Evaluations
- Feedback I Received
- Evaluation Details and Revision History (author only; Super Admin may inspect all)
- Notifications
- Super Admin Dashboard
- Manage Members and Roles
- Manage Evaluation Cycles
- Manage Rating Criteria and Form Settings
- All Evaluations (Super Admin only)
- Reports and Analytics
- Audit Logs
- System Settings and Privacy Policy

## 9. Non-Functional Requirements

- Security: role-based permissions, secure password hashing, input validation, CSRF protection where applicable, rate limiting, and least-privilege database access.
- Privacy: no evaluator identity leakage through UI, APIs, notifications, exports, URLs, or logs available to members.
- Performance: paginate long lists, index common filters, and avoid loading all evaluations at once.
- Reliability: handle reconnects for real-time features and preserve saved submissions if a connection drops.
- Accessibility: keyboard navigation, readable contrast, clear validation messages, and responsive layouts for phones and computers.
- Maintainability: separate Django apps by responsibility, reusable React components, documented APIs, and automated tests.
- Backup and recovery: schedule database backups, protect backup files, and test restoration periodically.

## 10. Recommended Django App Structure

```
backend/
  config/              # Django settings, URLs, ASGI/WSGI
  apps/
    accounts/          # registration, login, profiles, roles
    members/           # member directory and choir details
    evaluations/       # cycles, forms, ratings, comments, revisions
    notifications/     # in-app and real-time notifications
    reports/           # aggregates and exports
    audit/             # audit events and admin review
  manage.py

frontend/
  src/
    app/               # routes and app setup
    components/        # shared UI
    features/
      auth/
      members/
      evaluations/
      feedback/
      notifications/
      admin/
      reports/
    lib/               # API client and shared helpers
```

## 11. Suggested Implementation Phases

1. Phase 1 — Foundation: Create Django and React projects, connect MySQL, configure environment variables, authentication, roles, and basic tests.
2. Phase 2 — Member and Evaluation Flow: Build member directory, evaluation cycles, configurable criteria, evaluation form, and secure submission APIs.
3. Phase 3 — Feedback Privacy and Revisions: Build received feedback views, hide evaluator identities from members, and implement immutable edit history.
4. Phase 4 — Super Admin: Add God Mode dashboard, member management, rating configuration, reports, and audit logs.
5. Phase 5 — Real-Time: Add Channels/WebSockets, Redis, safe notifications, reconnect handling, and live dashboard updates.
6. Phase 6 — Quality and Deployment: Run security and permission tests, accessibility checks, backup/restore tests, production HTTPS setup, and deployment.

## 12. Acceptance Checklist
- [ ] New members can register and securely log in.
- [ ] Members can evaluate other members using the configured rating form.
- [ ] Members can see received ratings, comments, suggestions, and evaluation counts without evaluator names.
- [ ] Members can see and edit only their own submissions within the allowed time window.
- [ ] Every edit preserves a revision with the editor and timestamp.
- [ ] Super Admin can view evaluator identities, configure criteria/scales, manage members, inspect logs, and generate reports.
- [ ] Real-time updates work and reconnect gracefully after a network interruption.
- [ ] Automated tests confirm that ordinary users cannot access admin-only endpoints or infer evaluator identities.
- [ ] Production configuration uses environment variables, HTTPS, restricted CORS, secure cookies as applicable, and protected backups.

## 13. Decisions to Confirm Before Development

- Will registration be open to anyone, or will the Super Admin approve new choir-member accounts?
- Can every member evaluate every other member, or should evaluation access be limited by voice section, role, or evaluation cycle?
- Should members see individual ratings for each submission, only aggregated averages, or both?
- Should comments and suggestions be visible immediately, or only after the Super Admin reviews them?
- How long should members be allowed to edit an evaluation after submitting it?
- Should members be able to submit more than one evaluation for the same person in a cycle?
- Which notification channels are needed: in-app only, email, or both?
