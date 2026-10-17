import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AdminSettings, AuditEntry } from "../systemTypes";

const settings: AdminSettings = {
  system_name: "Choir Member Evaluation System",
  choir_name: "Test Choir",
  choir_description: "",
  time_zone: "UTC",
  registration_mode: "APPROVAL",
  min_aggregate_group_size: 3,
  feedback_notification_debounce_minutes: 60,
  privacy_notice: "Your name is hidden from members.",
  retention_evaluations_days: null,
  retention_revisions_days: null,
  retention_audit_days: 730,
  updated_at: "2026-10-01T00:00:00Z",
  updated_by: "Ana Admin",
};
const entry: AuditEntry = {
  id: 7,
  occurred_at: "2026-10-17T08:00:00Z",
  event_type: "system.settings.changed",
  actor: { public_id: "a1", name: "Ana Admin", username: "ana" },
  actor_role: "SUPER_ADMIN",
  target_type: "system.SystemSettings",
  target_id: "1",
  before: { choir_name: "" },
  after: { choir_name: "Test Choir" },
  metadata: {},
  ip_address: "10.0.0.1",
  user_agent: "Firefox",
  request_id: "r-123",
};

let patches: unknown[];
let auditSearches: string[];

beforeEach(() => {
  patches = [];
  auditSearches = [];
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/settings/"), () => HttpResponse.json(settings)),
    http.patch(api("/admin/settings/"), async ({ request }) => {
      const body = (await request.json()) as Partial<AdminSettings>;
      patches.push(body);
      if (body.choir_name === "Rejected") {
        return HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Check the highlighted fields.",
              fields: { choir_name: ["This name is not allowed."] },
            },
          },
          { status: 400 },
        );
      }
      return HttpResponse.json({ ...settings, ...body, updated_at: "2026-10-17T09:00:00Z" });
    }),
    http.get(api("/admin/audit-logs/"), ({ request }) => {
      auditSearches.push(new URL(request.url).search);
      return HttpResponse.json({ count: 1, next: null, previous: null, results: [entry] });
    }),
    http.get(api("/admin/audit-logs/event-types/"), () =>
      HttpResponse.json(["accounts.user.logged_in", "system.settings.changed"]),
    ),
  );
});

describe("Audit log (AUD-03/04)", () => {
  it("lists entries with their details and exports with the same filters", async () => {
    renderRoute("/admin/audit?event_type=system.settings.changed");
    const table = await screen.findByRole("table", { name: "Audit log" });
    expect(auditSearches[0]).toContain("event_type=system.settings.changed");
    expect(within(table).getByText("system.settings.changed")).toBeVisible();
    expect(within(table).getByText("Ana Admin")).toBeVisible();
    await userEvent.click(within(table).getByRole("button", { name: "Show details of entry 7" }));
    expect(await within(table).findByText(/"choir_name": "Test Choir"/)).toBeVisible();
    expect(within(table).getByText(/Request r-123/)).toBeVisible();
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute(
      "href",
      "/api/v1/admin/audit-logs/export/?file_type=csv&event_type=system.settings.changed",
    );
    expect(screen.getByText(/can't be changed or deleted/i)).toBeVisible();
  });

  it("searches (debounced) through the URL", async () => {
    const { router } = renderRoute("/admin/audit");
    await screen.findByRole("table", { name: "Audit log" });
    await userEvent.type(screen.getByLabelText(/search event/i), "10.0.0.1");
    await waitFor(() => {
      expect(router.state.location.search).toBe("?search=10.0.0.1");
    });
    expect(auditSearches.at(-1)).toBe("?search=10.0.0.1");
  });
});

describe("System settings (SET-01/03)", () => {
  it("saves only what changed", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute("/admin/settings");
    expect(await screen.findByText(/last changed .* by ana admin/i)).toBeVisible();
    const save = screen.getByRole("button", { name: "Save settings" });
    expect(save).toBeDisabled();
    const name = screen.getByLabelText("Choir name");
    await user.clear(name);
    await user.type(name, "St. Cecilia");
    await user.click(save);
    expect(await screen.findByText("Settings saved.")).toBeVisible();
    expect(patches).toEqual([{ choir_name: "St. Cecilia" }]);
  });

  it("keeps the privacy floor client-side and shows server field errors", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute("/admin/settings");
    const group = await screen.findByLabelText("Smallest group shown in averages");
    await user.clear(group);
    await user.type(group, "2");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/at least 3, so nobody can work out/i)).toBeVisible();
    expect(patches).toEqual([]);

    await user.clear(group);
    await user.type(group, "4");
    const name = screen.getByLabelText("Choir name");
    await user.clear(name);
    await user.type(name, "Rejected");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("This name is not allowed.")).toBeVisible();
    expect(screen.getByLabelText("Choir name")).toHaveAttribute("aria-invalid", "true");
    expect(patches).toEqual([{ choir_name: "Rejected", min_aggregate_group_size: 4 }]);
  });
});

describe("Privacy page (SET-03)", () => {
  it("is public, shows the choir's notice and is linked from the footer", async () => {
    renderRoute("/privacy");
    expect(
      await screen.findByText("Your name is hidden from members. The Super Admin can see it."),
    ).toBeVisible();
    expect(screen.getByRole("table", { name: "Who sees what" })).toHaveTextContent(
      "Never the member evaluated or other members",
    );
    expect(screen.getByRole("link", { name: "Privacy: who sees what" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
