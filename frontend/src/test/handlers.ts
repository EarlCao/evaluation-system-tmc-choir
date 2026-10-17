import { http, HttpResponse } from "msw";

import type { CurrentUser } from "@/features/auth";

/** Match API paths regardless of origin (jsdom serves from http://localhost:3000). */
export const api = (path: string) => `*/api/v1${path}`;

export const memberUser: CurrentUser = {
  public_id: "7f1d3c1e-0000-4000-8000-000000000001",
  username: "member_q1",
  email: "member_q1@example.org",
  first_name: "Mira",
  last_name: "Quell",
  display_name: "",
  role: "MEMBER",
  status: "ACTIVE",
  is_super_admin: false,
  email_verified: true,
  date_joined: "2026-10-17T08:00:00Z",
};

export const superAdminUser: CurrentUser = {
  ...memberUser,
  public_id: "7f1d3c1e-0000-4000-8000-000000000002",
  username: "admin_q1",
  first_name: "Ada",
  role: "SUPER_ADMIN",
  is_super_admin: true,
};

export const notAuthenticated = () =>
  HttpResponse.json(
    {
      error: {
        code: "not_authenticated",
        message: "Authentication credentials were not provided.",
      },
    },
    { status: 401 },
  );

/** Default: API healthy, visitor anonymous. Override per test with server.use(...). */
export const handlers = [
  http.get(api("/health/"), () => HttpResponse.json({ status: "ok", db: "ok" })),
  http.get(api("/auth/me/"), notAuthenticated),
  http.get(api("/auth/csrf/"), () =>
    HttpResponse.json(
      { detail: "CSRF cookie set." },
      { headers: { "Set-Cookie": "csrftoken=test-csrf-token; Path=/" } },
    ),
  ),
];

export const loggedInAs = (user: CurrentUser) =>
  http.get(api("/auth/me/"), () => HttpResponse.json(user));
