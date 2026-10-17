import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AdminDashboard } from "../types";

const base: AdminDashboard = {
  members: { registered: 24, active: 20, pending: 2, suspended: 1, deactivated: 1 },
  evaluations_submitted: 57,
  needs_moderation: 3,
  cycles: { DRAFT: 1, OPEN: 1, CLOSED: 3, ARCHIVED: 0 },
  open_cycle: {
    public_id: "c1",
    name: "Spring concert",
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: "2026-11-30T00:00:00Z",
    evaluation_scope: "ALL",
    evaluations_submitted: 41,
    possible_pairs: 380,
    submitted_pairs: 40,
    participating_members: 12,
    participation_percent: 10.5,
  },
};

function serve(data: AdminDashboard) {
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/reports/dashboard/"), () => HttpResponse.json(data)),
  );
}

describe("AdminDashboardPage (ADM-01)", () => {
  it("shows member, evaluation and participation statistics", async () => {
    serve(base);
    renderRoute("/admin");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Super Admin dashboard" }),
    ).toBeVisible();
    expect(await screen.findByText("Active members")).toBeVisible();
    expect(screen.getByText("24 registered")).toBeVisible();
    expect(screen.getByText("Waiting for approval").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Suspended or deactivated").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /needs moderation/i })).toHaveAttribute(
      "href",
      "/admin/moderation",
    );
    expect(screen.getByRole("meter", { name: "Participation" })).toHaveAttribute(
      "aria-valuenow",
      "10.5",
    );
    expect(screen.getByText(/40 of 380 possible evaluations · 12 members took part/)).toBeVisible();
    expect(screen.getByText(/1 draft · 1 open · 3 closed · 0 archived/)).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });

  it("handles no open period and an empty choir honestly", async () => {
    serve({ ...base, open_cycle: null });
    renderRoute("/admin");
    expect(await screen.findByText("No evaluation period is open")).toBeVisible();

    serve({
      ...base,
      open_cycle: { ...base.open_cycle!, participation_percent: null, possible_pairs: 0 },
    });
    renderRoute("/admin");
    expect(
      await screen.findByText(/no member can evaluate anyone in this period yet/i),
    ).toBeVisible();
  });

  it("is a Super Admin page (members are redirected)", async () => {
    server.use(http.get(api("/admin/reports/dashboard/"), () => HttpResponse.json(base)));
    const { router } = renderRoute("/admin"); // default handler: anonymous
    await screen.findByRole("heading", { name: /log in/i });
    expect(router.state.location.pathname).toBe("/login");
  });
});
