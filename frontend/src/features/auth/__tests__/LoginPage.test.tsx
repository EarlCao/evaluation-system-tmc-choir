import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, memberUser, notAuthenticated, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { CurrentUser } from "../types";

/** Session that becomes `user` after a successful login with `password`. */
function sessionServer(user: CurrentUser, password = "Correct-Horse-1") {
  let current: CurrentUser | null = null;
  const bodies: unknown[] = [];
  server.use(
    http.get(api("/auth/me/"), () => (current ? HttpResponse.json(current) : notAuthenticated())),
    http.post(api("/auth/logout/"), () => {
      current = null;
      return HttpResponse.json({ ok: true });
    }),
    http.post(api("/auth/login/"), async ({ request }) => {
      const body = (await request.json()) as { identifier: string; password: string };
      bodies.push(body);
      if (body.password !== password) {
        return HttpResponse.json(
          {
            error: {
              code: "invalid_credentials",
              message: "Invalid credentials or account not active.",
            },
          },
          { status: 400 },
        );
      }
      current = user;
      return HttpResponse.json(user);
    }),
  );
  return bodies;
}

async function fillAndSubmit(identifier: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username or email/i), identifier);
  await user.type(screen.getByLabelText(/^password/i, { selector: "input" }), password);
  await user.click(screen.getByRole("button", { name: /^log in$/i }));
}

describe("LoginPage", () => {
  it("keeps the skip link as the first keyboard tab stop", async () => {
    renderRoute("/login");
    await screen.findByRole("heading", { name: /^Log in$/ });
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
  });

  it("validates required fields on the client", async () => {
    renderRoute("/login");
    await userEvent.click(await screen.findByRole("button", { name: /^log in$/i }));
    expect(await screen.findByText("Enter your username or email.")).toBeVisible();
    expect(screen.getByText("Enter your password.")).toBeVisible();
  });

  it("logs a member in and lands on the member dashboard", async () => {
    const bodies = sessionServer(memberUser);
    const { router } = renderRoute("/login");
    await fillAndSubmit("member_q1", "Correct-Horse-1");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app");
    });
    expect(bodies).toEqual([{ identifier: "member_q1", password: "Correct-Horse-1" }]);
    expect(await screen.findByRole("button", { name: /log out/i })).toBeVisible();
  });

  it("refuses Super Admin credentials on the member login page and logs them in only on /admin", async () => {
    sessionServer(superAdminUser);
    const memberLogin = renderRoute("/login");
    await fillAndSubmit("admin_q1", "Correct-Horse-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Super Admin accounts must sign in at /admin.",
    );
    expect(memberLogin.router.state.location.pathname).toBe("/login");
    memberLogin.unmount();

    const adminLogin = renderRoute("/admin");
    await fillAndSubmit("admin_q1", "Correct-Horse-1");
    await waitFor(() => {
      expect(adminLogin.router.state.location.pathname).toBe("/admin");
    });
    expect(await screen.findByRole("button", { name: /log out/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /^profile$/i })).not.toBeInTheDocument();
  });

  it("returns to the page the visitor originally asked for", async () => {
    sessionServer(memberUser);
    const { router } = renderRoute("/app/profile"); // guard redirects to /login with state.from
    await fillAndSubmit("member_q1", "Correct-Horse-1");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app/profile");
    });
  });

  it("shows the server's generic error for bad credentials", async () => {
    sessionServer(memberUser);
    renderRoute("/login");
    await fillAndSubmit("member_q1", "wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials or account not active.",
    );
  });

  it("shows throttling messages", async () => {
    server.use(
      http.post(api("/auth/login/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "throttled",
              message: "Request was throttled. Expected available in 42 seconds.",
            },
          },
          { status: 429 },
        ),
      ),
    );
    renderRoute("/login");
    await fillAndSubmit("member_q1", "anything");
    expect(await screen.findByRole("alert")).toHaveTextContent(/throttled/i);
  });

  it("separates Member login (/) and Super Admin login (/admin), hiding Forgot password and Create account on /admin", async () => {
    const memberView = renderRoute("/");
    expect(await screen.findByRole("heading", { level: 1, name: /^log in$/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /forgot your password/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /create an account/i })).toBeVisible();
    memberView.unmount();

    renderRoute("/admin");
    expect(
      await screen.findByRole("heading", { level: 1, name: /super admin log in/i }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /forgot your password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create an account/i })).not.toBeInTheDocument();
  });

  it("toggles between light mode and dark mode from the header", async () => {
    const user = userEvent.setup();
    renderRoute("/");
    const toggle = await screen.findByRole("button", { name: /switch to dark mode/i });
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeVisible();
  });
});
