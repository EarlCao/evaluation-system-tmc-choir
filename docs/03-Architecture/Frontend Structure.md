---
tags: [architecture, frontend]
---
# Frontend Structure

## Vercel deployment routing

The root and frontend `vercel.json` configurations proxy `/api/` to the Render
backend. Match `/api/:path*/` before `/api/:path*`, preserving trailing slashes:
Django's API routes and frontend requests use them. The deployed slashless health
URL reached Django while its slash-terminated equivalent returned Vercel 404 until
the explicit rule was added (step 7.3). Frontend API calls use `/api/v1` so HTTP
session cookies remain on the frontend origin. Direct Render WebSocket connections
still need separate authentication validation when HTTP cookies use this proxy.

```
frontend/
├── index.html
├── package.json
├── vite.config.ts              # dev server :5280, proxy /api and /ws → Django :8010, Vitest config
├── tsconfig.json               # references tsconfig.app.json (src, strict) + tsconfig.node.json
├── eslint.config.js            # strictTypeChecked + hooks + boundary rules
├── .prettierrc.json
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── routes.tsx          # route tree; composes each feature's routes.tsx
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

## Implementation notes (step 1.5)
- **Versions:** React 19.3, Vite 8, TypeScript **6.0** (pinned: typescript-eslint supports TS < 6.1, ADR-015),
  React Router **8** (package `react-router`; `RouterProvider` comes from `react-router/dom`), MUI 9, TanStack Query 5,
  axios 1.20, Vitest 5 + jsdom, MSW 3 (`server.listen({ onUnhandledFrame: "error" })`).
- **Path alias:** `@/` → `src/`.
- **`lib/apiClient.ts`:** `baseURL /api/v1`, `withCredentials`, `xsrfCookieName: csrftoken` → `X-CSRFToken`
  (read on every request, so token rotation after login is handled). Every failure rejects with
  `ApiError {status, code, message, fields}` (`lib/errors.ts`; `network_error` / `http_error` when there's no envelope).
  `ensureCsrfCookie()` fetches `/auth/csrf/` once.
- **`lib/queryClient.ts`:** never retries 4xx; retries 5xx/network errors twice; staleTime 30s.
- **`features/auth`:** `useCurrentUser()` (`null` = anonymous), `fetchCurrentUser`, `authKeys`. Welcome page with a live `ApiStatus`.
- **Guards** (`app/guards`): `RequireAuth` → `/login` (keeps `state.from`); `RequireSuperAdmin` → `/app` for members;
  `GuestOnly` → `/app` or `/admin`. They share `useGuardState` (spinner, retryable error).
- **Layouts:** Public / Member / Admin, each with a skip link and `<main id="main">`.
- **Lint-enforced rules:** no `dangerouslySetInnerHTML`; no deep imports `@/features/x/...` (use the feature index);
  default axios import only in `lib/apiClient.ts`.
- **Tests:** `src/test/` (MSW server + default handlers: healthy API, anonymous visitor), `renderRoute(path)` renders the real route tree.
- **Bundle:** one 560 kB chunk (180 kB gzipped). Route-level code splitting is a follow-up (Phase 6 performance).

## Implementation notes (step 1.6): auth pages
- Pages (`features/auth/pages`): `LoginPage`, `RegisterPage` (voice-section select, pending/verify/active
  result screen), `ForgotPasswordPage` (identical answer always), `ResetPasswordPage` (`/reset-password/:uid/:token`),
  `VerifyEmailPage` (`/verify-email/:uid/:token`; **explicit button** so scanners and StrictMode never consume the
  single-use link), `ProfilePage` (`/app/profile`: names + change password). `AccountMenu` (name, Profile, Log out) sits in the member and admin headers.
- Redirects: `postLoginPath(user, from)` (internal paths only, so no open redirects; members never land in `/admin`).
  `GuestOnly` performs the post-login redirect.
- Forms: RHF + `zodResolver`, schemas in `features/auth/schemas.ts` mirroring backend rules (password ≥ 10, not all digits,
  username charset). `lib/forms.applyServerErrors` maps envelope `fields` onto inputs and everything else to `root.server`.
- Shared form components: `components/form/{FormTextField,PasswordField,FormAlert}`, `components/AuthCard`.
- Logout clears the whole query cache, so no previous user's data survives.
- Lint: `no-misused-promises` allows promise handlers in JSX attributes (RHF), and `_`-prefixed / rest-sibling vars may go unused.
- Tests: 53 (login / register / password / verify / profile / logout flows with stateful MSW handlers; `postLoginPath` cases).
  Password inputs are queried with `{ selector: "input" }` because the Show/Hide toggles carry specific accessible names.
