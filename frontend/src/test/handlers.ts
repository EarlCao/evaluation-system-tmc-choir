import { http, HttpResponse, ws } from "msw";

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

export const voiceSections = [
  { id: 1, name: "Soprano" },
  { id: 2, name: "Alto" },
  { id: 3, name: "Tenor" },
  { id: 4, name: "Bass" },
];

/** Default: API healthy, visitor anonymous. Override per test with server.use(...). */
/** WebSocket endpoints (MSW intercepts sockets; unhandled ones fail the test). */
export const notificationSocket = ws.link("*/ws/notifications"); // MSW drops the trailing slash before matching;
export const adminSocket = ws.link("*/ws/admin");

export const handlers = [
  notificationSocket.addEventListener("connection", () => {
    // accepted; the unread count comes from REST (tests push their own frames)
  }),
  adminSocket.addEventListener("connection", () => {
    // accepted; tests broadcast "dashboard.changed" when they need it
  }),
  http.get(api("/notifications/unread-count/"), () => HttpResponse.json({ unread: 0 })),
  http.get(api("/notifications/"), () =>
    HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
  ),
  http.get(api("/system/public/"), () =>
    HttpResponse.json({
      system_name: "Choir Member Evaluation System",
      choir_name: "Test Choir",
      choir_description: "",
      privacy_notice: "Your name is hidden from members. The Super Admin can see it.",
      registration_mode: "APPROVAL",
    }),
  ),
  http.get(api("/members/voice-sections/"), () => HttpResponse.json(voiceSections)),
  http.get(api("/evaluation-cycles/current/"), () => HttpResponse.json({ cycle: null })),
  http.get(api("/admin/comment-prompts/"), () =>
    HttpResponse.json([
      {
        public_id: "cp-1",
        key: "comment",
        label: "Comments (Unsay imong ikaingon sa akoa?)",
        is_required: false,
        sort_order: 1,
        is_active: true,
        is_archived: false,
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        public_id: "cp-2",
        key: "suggestion",
        label: "Suggestions (Unsay imong ikasuggest sa akoa?)",
        is_required: false,
        sort_order: 2,
        is_active: true,
        is_archived: false,
        created_at: "2026-10-01T00:00:00Z",
      },
    ]),
  ),
  http.get(api("/dashboard/"), () =>
    HttpResponse.json({
      active_members: 3,
      voice_section: "Tenor",
      open_cycle: null,
      feedback_received: 0,
    }),
  ),
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
