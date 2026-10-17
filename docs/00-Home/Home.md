---
tags: [moc, home]
---
# 🎼 Choir Member Evaluation System: Documentation Home

A private, organised and constructive way for choir members to evaluate one another,
share comments and suggestions, and review feedback **without revealing evaluator
identities to ordinary members**. The Super Admin can see identities.

> [!important] Rules for contributors and AI agents
> Read `AGENT.md` at the repository root before writing code. Work **one roadmap step at a time**. See [[Roadmap]].

## Start here
1. [[System Overview]]: what the system is
2. [[Roles and Permissions]]: who can do what
3. [[Privacy Model]]: the most important design constraint
4. [[Architecture Overview]]: modular monolith, module by module
5. [[Roadmap]]: phases and steps, and where we are now
6. [[Progress Log]]: what has been done

## Map of content

### 01 · Overview
- [[System Overview]]
- [[Roles and Permissions]]
- [[Glossary]]

### 02 · Requirements
- [[Functional Requirements]]: every requirement with an ID
- [[Business Rules]]
- [[Non-Functional Requirements]]
- [[Pages and Routes]]
- [[Acceptance Checklist]]

### 03 · Architecture
- [[Architecture Overview]]
- [[Backend Structure]]
- [[Frontend Structure]]
- [[Module Boundaries]]
- [[Privacy Model]]
- [[Security Model]]
- [[Realtime Architecture]]

### 04 · Modules
| Module | Backend app | Frontend feature | Phase |
|---|---|---|---|
| [[Core]] | `apps/core` | `lib/`, `components/` | 1 |
| [[Accounts]] | `apps/accounts` | `features/auth` | 1 |
| [[Audit]] | `apps/audit` | `features/admin` (viewer) | 1 (model), 4 (UI) |
| [[System Settings]] | `apps/system` | `features/admin` | 1 (model), 4 (UI) |
| [[Members]] | `apps/members` | `features/members` | 2 |
| [[Evaluations]] | `apps/evaluations` | `features/evaluations` | 2–3 |
| [[Feedback]] | `apps/feedback` | `features/feedback` | 3 |
| [[Reports]] | `apps/reports` | `features/reports`, `features/dashboard` | 4 |
| [[Notifications]] | `apps/notifications` | `features/notifications` | 5 |

### 05 · Data model
- [[Data Model]]

### 06 · API
- [[API Conventions]]
- [[API Endpoints]]

### 07 · Tech stack
- [[Tech Stack]]
- [[Dependencies]]
- [[Dev Environment Setup]]

### 08 · Roadmap
- [[Roadmap]]
- [[Progress Log]]

### 09 · Decisions
- [[Decisions Log]]
- [[Open Questions]]

### 10 · Testing
- [[Testing Strategy]]

### 99 · Source
- [[Source Requirements]]: full transcription of the original specification
- Original file: `99-Source/Choir_Member_Evaluation_System_Modules_and_Functionalities.docx`
