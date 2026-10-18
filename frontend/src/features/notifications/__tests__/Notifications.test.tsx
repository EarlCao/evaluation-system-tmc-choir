import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminSocket,
  api,
  loggedInAs,
  memberUser,
  notAuthenticated,
  notificationSocket,
  superAdminUser,
} from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AppNotification } from "../types";

const note = (id: string, extra: Partial<AppNotification> = {}): AppNotification => ({
  public_id: id,
  type: "FEEDBACK_AVAILABLE",
  message: "You have new feedback.",
  link: "/app/feedback",
  is_read: false,
  read_at: null,
  created_at: "2026-10-18T09:00:00Z",
  ...extra,
});

let posts: string[];
let unreadNow: number;

beforeEach(() => {
  posts = [];
  unreadNow = 0;
  server.use(
    loggedInAs(memberUser),
    http.get(api("/notifications/"), ({ request }) => {
      const unread = new URL(request.url).searchParams.get("unread") === "true";
      const results = [
        note("n1"),
        note("n2", {
          type: "CYCLE_OPENED",
          message: "Evaluation period “Spring” is open.",
          is_read: true,
        }),
      ].filter((n) => !unread || !n.is_read);
      return HttpResponse.json({ count: results.length, next: null, previous: null, results });
    }),
    http.post(api("/notifications/read-all/"), ({ request }) => {
      posts.push(new URL(request.url).pathname);
      unreadNow = 0;
      return HttpResponse.json({ marked: 1 });
    }),
    http.post(api("/notifications/:id/read/"), ({ request }) => {
      posts.push(new URL(request.url).pathname);
      return HttpResponse.json(note("n1", { is_read: true }));
    }),
  );
});

function pushUnread(count: number) {
  unreadNow = count;
  server.use(
    http.get(api("/notifications/unread-count/"), () => HttpResponse.json({ unread: unreadNow })),
    notificationSocket.addEventListener("connection", ({ client }) => {
      client.send(JSON.stringify({ type: "unread_count", payload: { unread: count } }));
    }),
  );
}

describe("Notification bell (RT-01, RT-02)", () => {
  it("shows the unread count pushed on connect and updates live", async () => {
    pushUnread(2);
    renderRoute("/app");
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();

    notificationSocket.broadcast(
      JSON.stringify({
        type: "notification.created",
        payload: { notification: note("n3"), unread: 3 },
        sent_at: "2026-10-18T09:00:00Z",
      }),
    );
    expect(await screen.findByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();
  });

  it("lists the latest, marks all read and opens a notification's link", async () => {
    pushUnread(1);
    const { router } = renderRoute("/app");
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    const dialog = await screen.findByRole("dialog", { name: "Notifications" });
    const list = await within(dialog).findByRole("list", { name: "Notifications" });
    expect(within(list).getByText("(unread)", { exact: false })).toBeInTheDocument();

    const markAll = within(dialog).getByRole("button", { name: "Mark all as read" });
    await userEvent.click(markAll);
    await waitFor(() => {
      expect(markAll).toBeDisabled(); // nothing left unread
    });
    expect(posts).toContain("/api/v1/notifications/read-all/");

    await userEvent.click(within(list).getByText("You have new feedback."));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app/feedback");
    });
    expect(posts).toContain("/api/v1/notifications/n1/read/");
  });

  it("falls back to polling and says so when the socket drops", async () => {
    server.use(
      notificationSocket.addEventListener("connection", ({ client }) => {
        client.close(1011, "server error");
      }),
    );
    renderRoute("/app");
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/checking every 30 seconds/i)).toBeVisible();
  });

  it("re-checks the session when the server revokes the socket", async () => {
    let meCalls = 0;
    server.use(
      http.get(api("/auth/me/"), () => {
        meCalls += 1;
        return meCalls === 1 ? HttpResponse.json(memberUser) : notAuthenticated();
      }),
      notificationSocket.addEventListener("connection", ({ client }) => {
        client.close(4001, "revoked");
      }),
    );
    const { router } = renderRoute("/app");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});

describe("Notification center", () => {
  it("lists everything and filters to unread", async () => {
    const { router } = renderRoute("/app/notifications");
    const list = await screen.findByRole("list", { name: "All notifications" });
    expect(within(list).getByText("Evaluation period “Spring” is open.")).toBeVisible();
    await userEvent.click(screen.getByLabelText("Unread only"));
    await waitFor(() => {
      expect(router.state.location.search).toBe("?unread=true");
    });
    await waitFor(() => {
      expect(screen.queryByText("Evaluation period “Spring” is open.")).not.toBeInTheDocument();
    });
  });
});

describe("Admin live dashboard (RT-01, RT-04)", () => {
  it("refetches the dashboard when the server says it changed", async () => {
    let dashboardCalls = 0;
    server.use(
      loggedInAs(superAdminUser),
      http.get(api("/admin/reports/dashboard/"), () => {
        dashboardCalls += 1;
        return HttpResponse.json({
          members: {
            registered: 5,
            active: 4,
            pending: dashboardCalls > 1 ? 1 : 0,
            suspended: 0,
            deactivated: 0,
          },
          evaluations_submitted: 0,
          needs_moderation: 0,
          cycles: { DRAFT: 0, OPEN: 0, CLOSED: 0, ARCHIVED: 0 },
          open_cycle: null,
        });
      }),
    );
    renderRoute("/admin");
    await screen.findByText("Active members");
    await waitFor(() => {
      expect(adminSocket.clients.size).toBeGreaterThan(0);
    });
    adminSocket.broadcast(JSON.stringify({ type: "dashboard.changed", payload: {} }));
    await waitFor(() => {
      expect(screen.getByText("Waiting for approval").nextElementSibling).toHaveTextContent("1");
    });
  });
});
