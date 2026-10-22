import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser, notAuthenticated, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("ProfilePage", () => {
  it("saves names and updates the header", async () => {
    let body: unknown;
    server.use(
      loggedInAs(memberUser),
      http.patch(api("/auth/me/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...memberUser, display_name: "Mimi" });
      }),
    );
    renderRoute("/app/profile");
    const user = userEvent.setup();
    const displayName = await screen.findByLabelText(/display name/i);
    await user.type(displayName, "Mimi");
    await user.click(screen.getByRole("button", { name: /save details/i }));

    expect(await screen.findByText("Your details were saved.")).toBeVisible();
    expect(body).toEqual({ first_name: "Mira", last_name: "Quell", display_name: "Mimi" });
    expect(screen.getByText("Mimi")).toBeVisible(); // AccountMenu shows the new name
  });

  it("maps a wrong current password to its field", async () => {
    server.use(
      loggedInAs(memberUser),
      http.post(api("/auth/password-change/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Please correct the highlighted fields.",
              fields: { old_password: ["Your current password is incorrect."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderRoute("/app/profile");
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/^current password/i, { selector: "input" }),
      "nope-nope-1",
    );
    await user.type(
      screen.getByLabelText(/^new password/i, { selector: "input" }),
      "Fresh-Harmony-2027",
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i, { selector: "input" }),
      "Fresh-Harmony-2027",
    );
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText("Your current password is incorrect.")).toBeVisible();
  });
});

describe("logout", () => {
  it.each(["/admin", "/admin/settings"])(
    "returns a Super Admin from %s to the admin login page",
    async (path) => {
      let loggedIn = true;
      server.use(
        http.get(api("/auth/me/"), () =>
          loggedIn ? HttpResponse.json(superAdminUser) : notAuthenticated(),
        ),
        http.post(api("/auth/logout/"), () => {
          loggedIn = false;
          return new HttpResponse(null, { status: 204 });
        }),
        http.get(api("/admin/reports/dashboard/"), () =>
          HttpResponse.json({
            members: { registered: 0, active: 0, pending: 0, suspended: 0, deactivated: 0 },
            evaluations_submitted: 0,
            needs_moderation: 0,
            cycles: { DRAFT: 0, OPEN: 0, CLOSED: 0, ARCHIVED: 0 },
            open_cycle: null,
          }),
        ),
      );
      const { router, queryClient } = renderRoute(path);
      queryClient.setQueryData(["private-admin-data"], { private: true });
      await userEvent.click(await screen.findByRole("button", { name: /^log out$/i }));
      await screen.findByRole("dialog");
      await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));

      expect(await screen.findByRole("heading", { name: /super admin log in/i })).toBeVisible();
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/admin");
      });
      expect(screen.queryByRole("button", { name: /^log out$/i })).not.toBeInTheDocument();
      expect(queryClient.getQueryData(["private-admin-data"])).toBeUndefined();
      expect(loggedIn).toBe(false);
    },
  );

  it("ends the session and returns to the welcome page", async () => {
    let loggedIn = true;
    server.use(
      http.get(api("/auth/me/"), () =>
        loggedIn ? HttpResponse.json(memberUser) : notAuthenticated(),
      ),
      http.post(api("/auth/logout/"), () => {
        loggedIn = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderRoute("/app");
    await userEvent.click(await screen.findByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });
});
