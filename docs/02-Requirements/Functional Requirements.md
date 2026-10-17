---
tags: [requirements]
---
# Functional Requirements

Every requirement has an **ID**. Use it in code comments, test docstrings, commits and
[[Progress Log]] entries for traceability. Source: [[Source Requirements]] §3.

Legend: **Module** = owning module note · **Ph** = roadmap phase ([[Roadmap]])

## 3.1 Authentication & Account Management: [[Accounts]]
| ID | Requirement | Ph |
|---|---|---|
| AUTH-01 | Member registration with name, email or username, password, and required choir profile details (voice section). | 1 |
| AUTH-02 | Login, logout, password reset, secure password storage. | 1 |
| AUTH-03 | Email verification **or** Super Admin approval can be enabled to prevent unauthorised registrations (setting `registration_mode`). | 1 |
| AUTH-04 | Profile page for viewing and updating permitted personal information. | 1–2 |
| AUTH-05 | Super Admin can activate, deactivate or suspend accounts and reset access. | 4 |
| AUTH-06 | Role-based access control separates ordinary members from Super Admin. | 1 |

## 3.2 Member Directory: [[Members]]
| ID | Requirement | Ph |
|---|---|---|
| MEM-01 | Display the active choir member list with basic profile information. | 2 |
| MEM-02 | Search and filter members by name, voice section, status, or other configured fields. | 2 |
| MEM-03 | Open a member profile to submit an evaluation or view feedback the logged-in member is authorised to see. | 2 |
| MEM-04 | Prevent members from evaluating themselves. | 2 |
| MEM-05 | Super Admin manages member details and account status. | 4 |

## 3.3 Evaluation Form & Rating Criteria: [[Evaluations]]
| ID | Requirement | Ph |
|---|---|---|
| EVAL-01 | Members evaluate other eligible members through a structured form. | 2 |
| EVAL-02 | Super Admin can create, rename, reorder, enable, disable and archive rating criteria. | 2 (API), 4 (UI) |
| EVAL-03 | Each criterion uses a configurable scale (1–5 points/stars, 0–100 percent). | 2 |
| EVAL-04 | Rating labels and descriptions (e.g. 1 = Needs Improvement, 5 = Excellent). | 2 |
| EVAL-05 | Written comments and constructive suggestions, optionally required, with character limits. | 2 |
| EVAL-06 | Configurable evaluation period/cycle (rehearsal month, concert prep, semester). | 2 |
| EVAL-07 | Validate submissions and show a confirmation before saving. | 2 |
| EVAL-08 | Prevent duplicate submissions for the same evaluator + recipient + form + cycle unless resubmission is allowed. | 2 |

## 3.4 Anonymous Feedback for Members: [[Feedback]]
| ID | Requirement | Ph |
|---|---|---|
| FB-01 | Members view the ratings, comments and suggestions they received. | 3 |
| FB-02 | Hide evaluator names, usernames, photos and other identifying details from the recipient. | 3 |
| FB-03 | Show the number of evaluations received and, where enabled, rating summaries and trends. | 3 |
| FB-04 | Filter feedback by cycle, criterion or date without revealing evaluator identity. | 3 |
| FB-05 | No evaluator identity via URLs, API responses, downloads, notifications or browser-visible metadata. | 3 |
| FB-06 | Clearly distinguish "anonymous to members" from "identity visible to Super Admin". | 3 |

## 3.5 My Submitted Evaluations & Editing: [[Evaluations]]
| ID | Requirement | Ph |
|---|---|---|
| MINE-01 | Members view the evaluations, comments and suggestions they personally submitted. | 2 |
| MINE-02 | Author can edit own evaluation while the period is open or per Super Admin settings. | 3 |
| MINE-03 | Save an immutable version history whenever a submission is created or edited. | 3 |
| MINE-04 | Show original content, edited content, date/time of each change and the account that made it to the author and Super Admin. | 3 |
| MINE-05 | The recipient never sees who authored or edited; they see only the current approved content. | 3 |
| MINE-06 | Optionally show an "Edited" label to the recipient without revealing the editor. | 3 |
| MINE-07 | Ordinary users cannot edit another member's submission. | 2–3 |

## 3.6 Super Admin Dashboard (God Mode): [[Reports]], [[Evaluations]], [[Accounts]]
| ID | Requirement | Ph |
|---|---|---|
| ADM-01 | System-wide stats: registered, active, evaluations submitted/received, participation rate, cycle status. | 4 |
| ADM-02 | Browse all evaluations, ratings, comments, suggestions, evaluator identities, recipients, timestamps and edit histories. | 4 |
| ADM-03 | Search, filter, sort by member, evaluator, criterion, cycle, date, rating, status. | 4 |
| ADM-04 | Manage users, roles, evaluation periods, rating criteria, form settings, system policies. | 4 |
| ADM-05 | Moderate or flag inappropriate feedback per documented policy, retaining the original and moderation history. | 4 |
| ADM-06 | View system activity and important events through audit logs. | 4 |
| ADM-07 | Export authorised reports to CSV/Excel; print or export summaries to PDF. | 4 |

## 3.7 Rating & Evaluation Configuration: [[Evaluations]]
| ID | Requirement | Ph |
|---|---|---|
| CFG-01 | Create custom rating criteria and categories. | 2 |
| CFG-02 | Choose scale type per criterion: numeric 1–5, percentage 0–100, or another supported scale. | 2 |
| CFG-03 | Set min/max, step, labels, descriptions, required flag. | 2 |
| CFG-04 | Configure whether comments and suggestions are optional or required. | 2 |
| CFG-05 | Configure who can evaluate whom, evaluation deadlines, editing deadlines, resubmission. | 2 |
| CFG-06 | Version form settings so historical evaluations keep the scale/criteria active at submission. | 2 |

## 3.8 Reports & Analytics: [[Reports]]
| ID | Requirement | Ph |
|---|---|---|
| REP-01 | Individual member summaries, choir-wide summaries, criterion averages, participation reports. | 4 |
| REP-02 | Counts of received evaluations and aggregate rating trends over time. | 3 (member), 4 (admin) |
| REP-03 | Filter by cycle, date range, member, voice section, criterion. | 4 |
| REP-04 | Clear explanations for averages and percentages; **missing ratings are not zero**. | 3–4 |
| REP-05 | Reports containing evaluator identities restricted to Super Admin. | 4 |
| REP-06 | Privacy thresholds: suppress small-group breakdowns that could reveal who submitted. | 3–4 |

## 3.9 Audit Logs & Version History: [[Audit]]
| ID | Requirement | Ph |
|---|---|---|
| AUD-01 | Record login activity, failed logins, account/role changes, evaluation create/edit, config changes, exports, moderation, admin access to sensitive records. | 1 onward |
| AUD-02 | Each entry: actor, action, affected record, timestamp, before/after values where appropriate. | 1 |
| AUD-03 | Logs read-only to members; no routine deletion or alteration. | 1 |
| AUD-04 | Super Admin searches, filters and exports logs. | 4 |
| AUD-05 | Evaluation version history kept **separate** from general audit logs. | 3 |

## 3.10 Real-Time Updates & Notifications: [[Notifications]]
| ID | Requirement | Ph |
|---|---|---|
| RT-01 | WebSockets for live dashboard counts, new feedback availability, evaluation status, admin activity. | 5 |
| RT-02 | Notify a member of new feedback without identifying the evaluator. | 5 |
| RT-03 | Notify on cycle open/close and when their own submitted evaluation was edited (where appropriate). | 5 |
| RT-04 | Notify Super Admin: unusual activity, registrations awaiting approval, cycle completion. | 5 |
| RT-05 | Fallback refresh/polling when WebSocket is unavailable. | 5 |
| RT-06 | No private evaluator details in push, email or in-app notifications to members. | 5 |

## 3.11 Settings, Privacy & Data Management: [[System Settings]]
| ID | Requirement | Ph |
|---|---|---|
| SET-01 | Configure system name, choir info, time zone, evaluation policies, notification preferences. | 1 (model), 4 (UI) |
| SET-02 | Retention rules for evaluation records, version history, audit logs. | 6 |
| SET-03 | Privacy notice describing who sees feedback and who sees evaluator identities. | 2 (shown on form), 4 (editable) |
| SET-04 | Secure backups and tested restore procedures. | 6 |
| SET-05 | Data export or account-deactivation workflows per choir policy. | 4–6 |
| SET-06 | Soft deletion / archival to preserve auditability. | all |

Related: [[Business Rules]] · [[Non-Functional Requirements]] · [[Acceptance Checklist]]
