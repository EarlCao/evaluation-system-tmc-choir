---
tags: [architecture, frontend]
---
# Frontend Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts              # proxy /api and /ws → http://localhost:8000
├── tsconfig.json               # strict
├── eslint.config.js
├── .prettierrc
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx          # composes each feature's routes.tsx
    │   ├── providers.tsx       # QueryClientProvider, ThemeProvider, AuthProvider
    │   ├── layouts/            # PublicLayout, MemberLayout, AdminLayout
    │   └── guards/             # RequireAuth, RequireSuperAdmin, GuestOnly (UX only)
    ├── components/             # shared UI: PageHeader, DataTable, ConfirmDialog, EmptyState, RatingInput, PrivacyNotice
    ├── features/
    │   ├── auth/               # login, register, password reset, profile, current-user hook
    │   ├── dashboard/          # member dashboard
    │   ├── members/            # directory, member profile
    │   ├── evaluations/        # evaluate form, my evaluations, detail + revisions
    │   ├── feedback/           # feedback I received (anonymised), summaries, charts
    │   ├── notifications/      # notification center, WS subscription
    │   ├── admin/              # god-mode: members, cycles, criteria/forms, all evaluations, moderation, audit, settings
    │   └── reports/            # reports & analytics, exports
    ├── lib/
    │   ├── apiClient.ts        # axios instance: baseURL /api/v1, withCredentials, CSRF header, error normalisation
    │   ├── queryClient.ts
    │   ├── ws.ts               # reconnecting WebSocket client + polling fallback
    │   └── format.ts           # dates (day precision for feedback), numbers
    ├── styles/                 # MUI theme, tokens
    └── test/                   # setup.ts, render helpers, MSW handlers
```

## Feature folder shape
```
features/<feature>/
├── index.ts        # PUBLIC exports only
├── api.ts          # raw axios calls
├── queries.ts      # useXQuery / useXMutation + queryKeys
├── schemas.ts      # zod
├── types.ts
├── routes.tsx
├── components/
├── pages/
└── __tests__/
```

## Rules
- Features import from other features **only via `index.ts`**.
- Server state is **TanStack Query only**. After a mutation, invalidate by query key.
- Every form uses **React Hook Form + zodResolver**. Server validation errors map to
  fields from the error envelope ([[API Conventions]]).
- The evaluate flow has an explicit **review/confirm step** that shows the
  `PrivacyNotice` component before submission (EVAL-07, privacy rule).
- Never render user content as HTML. No `dangerouslySetInnerHTML`.
- Admin pages live under `/admin` with `AdminLayout`. The API enforces access anyway.

Related: [[Pages and Routes]] · [[Tech Stack]]
