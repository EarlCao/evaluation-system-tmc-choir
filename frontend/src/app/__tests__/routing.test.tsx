import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const heading = (name: RegExp) => screen.findByRole("heading", { level: 1, name });

describe("route guards (UX only, the API enforces access)", () => {
  it("sends anonymous visitors from /app to /login", async () => {
    const { router } = renderRoute("/app");
    expect(await heading(/log in/i)).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.state).toEqual({ from: "/app" });
  });

  it("lets members into the member area", async () => {
    server.use(loggedInAs(memberUser));
    renderRoute("/app");
    expect(await heading(/welcome, mira/i)).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  it("keeps members out of the admin area", async () => {
    server.use(loggedInAs(memberUser));
    const { router } = renderRoute("/admin");
    expect(await heading(/welcome, mira/i)).toBeVisible();
    expect(router.state.location.pathname).toBe("/app");
  });

  it("lets super admins into the admin area without a profile button and keeps them out of /app", async () => {
    server.use(loggedInAs(superAdminUser));
    const view = renderRoute("/admin");
    expect(await heading(/super admin dashboard/i)).toBeVisible();
    expect(screen.getByText("Super Admin")).toBeVisible();
    expect(screen.queryByRole("link", { name: /^profile$/i })).not.toBeInTheDocument();
    view.unmount();

    const { router } = renderRoute("/app/profile");
    expect(await heading(/super admin dashboard/i)).toBeVisible();
    expect(router.state.location.pathname).toBe("/admin");
  });

  it.each([
    [memberUser, "/app"],
    [superAdminUser, "/admin"],
  ])("sends logged-in users away from /login", async (user, home) => {
    server.use(loggedInAs(user));
    const { router } = renderRoute("/login");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(home);
    });
  });

  it("shows a retryable error when the session cannot be checked", async () => {
    server.use(http.get(api("/auth/me/"), () => new HttpResponse(null, { status: 500 })));
    renderRoute("/app");
    expect(await screen.findByText(/couldn't check your session/i)).toBeVisible();

    server.use(loggedInAs(memberUser));
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await heading(/welcome, mira/i)).toBeVisible();
  });
});

describe("other routes", () => {
  it("shows a not-found page for unknown paths", async () => {
    renderRoute("/does-not-exist");
    expect(await heading(/page not found/i)).toBeVisible();
  });

  it("offers a skip link to the main content", async () => {
    renderRoute("/");
    expect(await screen.findByRole("link", { name: /skip to content/i })).toHaveAttribute(
      "href",
      "#main",
    );
    expect(document.getElementById("main")).not.toBeNull();
  });
});
