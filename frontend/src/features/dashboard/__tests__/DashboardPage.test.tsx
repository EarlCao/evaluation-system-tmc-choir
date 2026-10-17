import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("DashboardPage", () => {
  it("greets the member and shows their numbers", async () => {
    server.use(loggedInAs(memberUser));
    renderRoute("/app");
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Mira" })).toBeVisible();
    expect(await screen.findByText("Active choir members")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("Tenor")).toBeVisible();
    expect(screen.getByText("No evaluation period is open")).toBeVisible();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "My evaluations" }),
    ).toHaveAttribute("href", "/app/my-evaluations");
  });

  it("shows open-cycle progress with a call to action", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/dashboard/"), () =>
        HttpResponse.json({
          active_members: 12,
          voice_section: "Tenor",
          open_cycle: {
            public_id: "c1",
            name: "Spring concert",
            ends_at: "2026-11-30T00:00:00Z",
            evaluations_given: 2,
            members_left: 9,
          },
        }),
      ),
    );
    renderRoute("/app");
    expect(await screen.findByRole("heading", { name: "Spring concert is open" })).toBeVisible();
    expect(screen.getByText(/you have evaluated 2 members, 9 to go/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Evaluate members" })).toHaveAttribute(
      "href",
      "/app/members",
    );
  });

  it("marks the current page in the main navigation", async () => {
    server.use(loggedInAs(memberUser));
    renderRoute("/app/members");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Members");
  });
});
