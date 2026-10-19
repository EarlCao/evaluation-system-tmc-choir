import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AdminMember, AdminVoiceSection } from "../types";

const tenor: AdminVoiceSection = {
  id: 3,
  name: "Tenor",
  sort_order: 3,
  is_active: true,
  member_count: 4,
};
const bass: AdminVoiceSection = {
  id: 4,
  name: "Bass",
  sort_order: 4,
  is_active: true,
  member_count: 2,
};

const pending: AdminMember = {
  public_id: "11111111-0000-4000-8000-000000000001",
  username: "penny_q",
  email: "penny@example.org",
  first_name: "Penny",
  last_name: "Lane",
  display_name: "",
  role: "MEMBER",
  status: "PENDING",
  email_verified: false,
  date_joined: "2026-10-16T09:00:00Z",
  last_login: null,
  approved_at: null,
  profile: { voice_section: tenor, is_evaluable: true, joined_choir_on: null, bio: "" },
};
const active: AdminMember = {
  ...pending,
  public_id: "11111111-0000-4000-8000-000000000002",
  first_name: "Aria",
  status: "ACTIVE",
};

let current: AdminMember;
let posts: { url: string; body: unknown }[];
let listParams: URLSearchParams[];

beforeEach(() => {
  current = pending;
  posts = [];
  listParams = [];
  const respond = async (request: Request, patch: Partial<AdminMember>) => {
    posts.push({
      url: new URL(request.url).pathname,
      body: await request.json().catch(() => null),
    });
    current = { ...current, ...patch };
    return HttpResponse.json(current);
  };
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/members/"), ({ request }) => {
      listParams.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        count: 2,
        next: null,
        previous: null,
        results: [pending, active],
      });
    }),
    http.get(api("/admin/members/:id/"), () => HttpResponse.json(current)),
    http.post(api("/admin/members/:id/approve/"), ({ request }) =>
      respond(request, { status: "ACTIVE", approved_at: "2026-10-17T10:00:00Z" }),
    ),
    http.post(api("/admin/members/:id/status/"), async ({ request }) => {
      const body = (await request.clone().json()) as { status: AdminMember["status"] };
      return respond(request, { status: body.status });
    }),
    http.post(api("/admin/members/:id/role/"), ({ request }) =>
      respond(request, { role: "SUPER_ADMIN" }),
    ),
    http.patch(api("/admin/members/:id/"), async ({ request }) => {
      const body = (await request.json()) as { voice_section: number; is_evaluable: boolean };
      posts.push({ url: "patch", body });
      current = {
        ...current,
        profile: { ...current.profile!, voice_section: bass, is_evaluable: body.is_evaluable },
      };
      return HttpResponse.json(current);
    }),
    http.get(api("/admin/voice-sections/"), () => HttpResponse.json([tenor, bass])),
  );
});

describe("Admin members", () => {
  it("lists accounts and filters by status", async () => {
    renderRoute("/admin/members");
    const table = await screen.findByRole("table", { name: "Members" });
    expect(within(table).getByRole("link", { name: "Penny Lane" })).toHaveAttribute(
      "href",
      `/admin/members/${pending.public_id}`,
    );
    expect(within(table).getByText("Waiting for approval")).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "Suspended" }),
    );
    await waitFor(() => {
      expect(listParams.at(-1)?.get("status")).toBe("SUSPENDED");
    });
  });

  it("approves a pending account", async () => {
    renderRoute(`/admin/members/${pending.public_id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Account approved.")).toBeVisible();
    expect(posts[0]?.url).toBe(`/api/v1/admin/members/${pending.public_id}/approve/`);
  });

  it("suspends with a confirmation and a reason", async () => {
    current = active;
    const user = userEvent.setup();
    renderRoute(`/admin/members/${active.public_id}`);
    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog", { name: "Suspend this account?" });
    await user.type(within(dialog).getByLabelText(/reason/i), "Repeated no-shows");
    await user.click(within(dialog).getByRole("button", { name: "Suspend" }));
    expect(await screen.findByText("Status changed to suspended.")).toBeVisible();
    expect(posts[0]?.body).toEqual({ status: "SUSPENDED", reason: "Repeated no-shows" });
  });

  it("can cancel a confirmation without changing anything", async () => {
    current = active;
    renderRoute(`/admin/members/${active.public_id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }),
    );
    expect(posts).toEqual([]);
  });

  it("does not show Make Super Admin button for members", async () => {
    current = active;
    renderRoute(`/admin/members/${active.public_id}`);
    await screen.findByRole("heading", { name: /aria lane/i });
    expect(screen.queryByRole("button", { name: "Make Super Admin" })).not.toBeInTheDocument();
  });

  it("does not allow changing a Super Admin account to member", async () => {
    current = { ...active, role: "SUPER_ADMIN", profile: null };
    renderRoute(`/admin/members/${active.public_id}`);
    await screen.findByRole("heading", { name: /aria lane/i });
    expect(screen.queryByRole("button", { name: "Change to member" })).not.toBeInTheDocument();
  });

  it("shows server refusals", async () => {
    current = active;
    server.use(
      http.post(api("/admin/members/:id/status/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "business_rule_violation",
              message: "You cannot change the status of your own account.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderRoute(`/admin/members/${active.public_id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Deactivate" }),
    );
    expect(
      await screen.findByText("You cannot change the status of your own account."),
    ).toBeVisible();
  });

  it("edits the choir profile", async () => {
    current = active;
    const user = userEvent.setup();
    renderRoute(`/admin/members/${active.public_id}`);
    await user.click(await screen.findByRole("combobox", { name: "Voice section" }));
    await user.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "Bass" }),
    );
    await user.click(screen.getByRole("switch", { name: /can be evaluated/i }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(posts.at(-1)?.body).toEqual({
      voice_section: 4,
      is_evaluable: false,
      joined_choir_on: null,
      is_officer: false,
      officer_position: "",
    });
  });
});

describe("Admin voice sections", () => {
  it("lists sections with member counts and adds one", async () => {
    let created: unknown;
    server.use(
      http.post(api("/admin/voice-sections/"), async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(
          { id: 9, name: "Baritone", sort_order: 9, is_active: true, member_count: null },
          { status: 201 },
        );
      }),
    );
    renderRoute("/admin/voice-sections");
    const table = await screen.findByRole("table", { name: "Voice sections" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await userEvent.type(screen.getByLabelText("New voice section"), "Baritone");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(created).toEqual({ name: "Baritone" });
    });
  });
});
