import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import { criterionSchema, labelledPoints } from "../configSchemas";
import type { AdminCycle, Criterion, FormVersion } from "../configTypes";

const version = (id: number, name: string, extra: Partial<Criterion["current_version"]> = {}) => ({
  id,
  version: 1,
  name,
  description: "",
  scale_type: "NUMERIC" as const,
  min_value: 1,
  max_value: 5,
  step: 1,
  labels: { "5": "Excellent" },
  is_required: true,
  created_at: "2026-10-01T00:00:00Z",
  ...extra,
});
const criteria: Criterion[] = [
  {
    public_id: "k1",
    key: "attendance",
    category: null,
    sort_order: 1,
    is_active: true,
    is_archived: false,
    current_version: version(11, "Attendance"),
    created_at: "2026-10-01T00:00:00Z",
  },
  {
    public_id: "k2",
    key: "teamwork",
    category: null,
    sort_order: 2,
    is_active: true,
    is_archived: false,
    current_version: version(12, "Teamwork", { version: 2 }),
    created_at: "2026-10-01T00:00:00Z",
  },
];
const published: FormVersion = {
  public_id: "f1",
  version: 1,
  title: "Standard",
  status: "PUBLISHED",
  comment_required: true,
  suggestion_required: false,
  comment_max_length: 2000,
  suggestion_max_length: 2000,
  published_at: "2026-10-02T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  items: [{ order: 1, criterion_public_id: "k1", criterion_version: version(11, "Attendance") }],
};
const draftCycle: AdminCycle = {
  public_id: "c1",
  name: "Spring",
  description: "",
  starts_at: "2026-10-01T08:00:00Z",
  ends_at: "2026-11-01T08:00:00Z",
  edit_deadline: "2026-11-01T08:00:00Z",
  status: "DRAFT",
  form_version: { public_id: "f1", version: 1, title: "Standard" },
  allow_resubmission: false,
  evaluation_scope: "ALL",
  feedback_visibility: "IMMEDIATE",
  opened_at: null,
  closed_at: null,
  created_at: "2026-10-01T00:00:00Z",
};

let calls: { method: string; path: string; body: unknown }[];

beforeEach(() => {
  calls = [];
  const record = async (request: Request) => {
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: await request
        .clone()
        .json()
        .catch(() => null),
    });
  };
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/criteria/"), () => HttpResponse.json(criteria)),
    http.get(api("/admin/criterion-categories/"), () => HttpResponse.json([])),
    http.post(api("/admin/criteria/reorder/"), async ({ request }) => {
      await record(request);
      return HttpResponse.json(criteria);
    }),
    http.post(api("/admin/criteria/"), async ({ request }) => {
      await record(request);
      return HttpResponse.json(criteria[0], { status: 201 });
    }),
    http.get(api("/admin/form-versions/"), () =>
      HttpResponse.json({ count: 1, next: null, previous: null, results: [published] }),
    ),
    http.get(api("/admin/form-versions/f1/"), () => HttpResponse.json(published)),
    http.get(api("/admin/evaluation-cycles/"), () =>
      HttpResponse.json({ count: 1, next: null, previous: null, results: [draftCycle] }),
    ),
    http.get(api("/admin/evaluation-cycles/c1/"), () => HttpResponse.json(draftCycle)),
    http.post(api("/admin/evaluation-cycles/c1/open/"), async ({ request }) => {
      await record(request);
      return HttpResponse.json(
        {
          error: {
            code: "business_rule_violation",
            message: "Another cycle is already open. Close it first.",
          },
        },
        { status: 409 },
      );
    }),
  );
});

describe("criterion scale schema (mirrors the server)", () => {
  const base = {
    name: "X",
    description: "",
    category: "",
    scale_type: "NUMERIC" as const,
    labels: [],
    is_required: true,
  };
  it.each([
    [{ min_value: 1, max_value: 5, step: 1 }, true],
    [{ min_value: 0, max_value: 100, step: 5 }, true],
    [{ min_value: 5, max_value: 1, step: 1 }, false],
    [{ min_value: 1, max_value: 5, step: 1.5 }, false],
    [{ min_value: 0, max_value: 1000, step: 1 }, false],
    [{ min_value: -1, max_value: 5, step: 1 }, false],
  ])("%o valid=%s", (scale, ok) => {
    expect(criterionSchema.safeParse({ ...base, ...scale }).success).toBe(ok);
  });

  it("rejects percent scales above 100 and offers labels only for small scales", () => {
    expect(
      criterionSchema.safeParse({
        ...base,
        scale_type: "PERCENT",
        min_value: 0,
        max_value: 150,
        step: 10,
      }).success,
    ).toBe(false);
    expect(labelledPoints({ min_value: 1, max_value: 5, step: 1 })).toEqual([1, 2, 3, 4, 5]);
    expect(labelledPoints({ min_value: 0, max_value: 100, step: 5 })).toEqual([]);
  });
});

describe("Admin criteria page", () => {
  it("lists criteria with version and reorders them", async () => {
    renderRoute("/admin/criteria");
    const table = await screen.findByRole("table", { name: "Criteria" });
    expect(within(table).getByText("v2")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Move Teamwork up" }));
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({
        path: "/api/v1/admin/criteria/reorder/",
        body: { order: ["k2", "k1"] },
      });
    });
  });

  it("creates a criterion with labels and blocks invalid scales client-side", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute("/admin/criteria");
    await user.click(await screen.findByRole("button", { name: "New criterion" }));
    const dialog = await screen.findByRole("dialog", { name: "New criterion" });
    await user.type(within(dialog).getByLabelText("Name"), "Blend");
    const step = within(dialog).getByLabelText("Step");
    await user.clear(step);
    await user.type(step, "3");
    await user.click(within(dialog).getByRole("button", { name: "Create criterion" }));
    expect(
      await within(dialog).findByText("The step must divide the range exactly."),
    ).toBeVisible();
    expect(calls).toEqual([]);

    await user.clear(step);
    await user.type(step, "1");
    await user.type(within(dialog).getByLabelText("Label for 1"), "Needs improvement");
    await user.click(within(dialog).getByRole("button", { name: "Create criterion" }));
    await waitFor(() => {
      expect(calls.at(-1)?.body).toEqual({
        name: "Blend",
        description: "",
        category: null,
        scale_type: "NUMERIC",
        min_value: 1,
        max_value: 5,
        step: 1,
        labels: { "1": "Needs improvement" },
        is_required: true,
      });
    });
  });

  it("displays numbered comment prompts on the criteria page", async () => {
    renderRoute("/admin/criteria");
    const promptsTable = await screen.findByRole("table", { name: "Comment prompts" });
    expect(
      within(promptsTable).getByText("1. Comments (Unsay imong ikaingon sa akoa?)"),
    ).toBeVisible();
    expect(
      within(promptsTable).getByText("2. Suggestions (Unsay imong ikasuggest sa akoa?)"),
    ).toBeVisible();
  });
});

describe("Admin forms", () => {
  it("shows a published form read-only with a copy action", async () => {
    renderRoute("/admin/forms/f1");
    expect(await screen.findByText(/published forms can't change/i)).toBeVisible();
    expect(screen.getByRole("list", { name: "Criteria in this form" })).toHaveTextContent(
      "Attendance",
    );
    expect(screen.getByRole("list", { name: "Comment prompts in this form" })).toHaveTextContent(
      "Comments (Unsay imong ikaingon sa akoa?)",
    );
    expect(screen.getByRole("link", { name: "Copy into a new draft" })).toHaveAttribute(
      "href",
      "/admin/forms/new?from=f1",
    );
    expect(screen.queryByRole("button", { name: /save draft/i })).not.toBeInTheDocument();
  });
});

describe("Admin periods", () => {
  it("lists periods and shows server conflicts when opening", async () => {
    renderRoute("/admin/cycles");
    await userEvent.click(await screen.findByRole("link", { name: "Spring" }));
    await userEvent.click(await screen.findByRole("button", { name: "Open period" }));
    const dialog = await screen.findByRole("dialog", { name: "Open this period?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Open period" }));
    expect(await screen.findByText("Another cycle is already open. Close it first.")).toBeVisible();
  });

  it("locks settings that can't change for an open period", async () => {
    server.use(
      http.get(api("/admin/evaluation-cycles/c1/"), () =>
        HttpResponse.json({ ...draftCycle, status: "OPEN" }),
      ),
    );
    renderRoute("/admin/cycles/c1");
    expect(
      await screen.findByText(/some settings are locked while the period is open/i),
    ).toBeVisible();
    expect(screen.getByLabelText("Starts")).toBeDisabled();
    expect(screen.getByLabelText("Ends")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Close period" })).toBeVisible();
  });

  it("validates dates before saving a new period", async () => {
    renderRoute("/admin/cycles/new");
    await userEvent.click(await screen.findByRole("button", { name: "Create period" }));
    expect(await screen.findByText("Enter a name.")).toBeVisible();
    expect(screen.getByText("Choose a start.")).toBeVisible();
  });
});
