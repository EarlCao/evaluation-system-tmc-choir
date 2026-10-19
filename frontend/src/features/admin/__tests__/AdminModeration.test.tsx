import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AdminEvaluationDetail, AdminRevision, Person } from "../moderationTypes";

const person = (id: string, first: string, last: string): Person => ({
  public_id: id,
  first_name: first,
  last_name: last,
  display_name: first,
  voice_section: "Alto",
});
const recipient = person("r1", "Rosa", "Reyes");
const evaluator = person("e1", "Ernesto", "Cruz");

const detail: AdminEvaluationDetail = {
  public_id: "ev1",
  cycle: { public_id: "c1", name: "Spring", status: "OPEN" },
  evaluator,
  recipient,
  submitted_at: "2026-10-05T10:00:00Z",
  last_edited_at: "2026-10-06T10:00:00Z",
  is_edited: true,
  current_revision_number: 2,
  moderation_status: "VISIBLE",
  needs_attention: false,
  ratings: [
    {
      criterion_public_id: "k1",
      criterion_name: "Attendance",
      criterion_version: 1,
      scale_type: "NUMERIC",
      max_value: 5,
      value: 4,
      label: "Very good",
    },
  ],
  comment: { body: "Always on time.", moderation_status: "VISIBLE" },
  suggestion: { body: "Breathe earlier.", moderation_status: "FLAGGED" },
  moderation_history: [
    {
      target: "SUGGESTION",
      action: "FLAG",
      reason: "Check tone",
      actor: "Ana Admin",
      created_at: "2026-10-07T10:00:00Z",
    },
  ],
};
const snapshot = (value: string, comment: string) => ({
  form_version_id: 1,
  ratings: [{ criterion_version_id: 11, criterion: "Attendance", value, label: "" }],
  comment,
  suggestion: "Breathe earlier.",
});
const revisions: AdminRevision[] = [
  {
    revision_number: 1,
    created_at: "2026-10-05T10:00:00Z",
    change_summary: "Submitted",
    editor: evaluator,
    snapshot: snapshot("3", "On time."),
  },
  {
    revision_number: 2,
    created_at: "2026-10-06T10:00:00Z",
    change_summary: "Edited",
    editor: evaluator,
    snapshot: snapshot("4", "Always on time."),
  },
];

let requests: { path: string; search: string; body: unknown }[];

beforeEach(() => {
  requests = [];
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/evaluations/"), ({ request }) => {
      const url = new URL(request.url);
      requests.push({ path: url.pathname, search: url.search, body: null });
      if (url.searchParams.get("rating_max") === "1") {
        return HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Check the filters.",
              fields: { rating_max: ["Must be at least the minimum."] },
            },
          },
          { status: 400 },
        );
      }
      return HttpResponse.json({ count: 1, next: null, previous: null, results: [detail] });
    }),
    http.get(api("/admin/moderation-queue/"), () =>
      HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
    ),
    http.get(api("/admin/evaluations/ev1/"), () => HttpResponse.json(detail)),
    http.get(api("/admin/evaluations/ev1/revisions/"), () => HttpResponse.json(revisions)),
    http.post(api("/admin/evaluations/ev1/moderate/"), async ({ request }) => {
      const body = (await request.json()) as { target: string; action: string };
      requests.push({ path: "moderate", search: "", body });
      return HttpResponse.json({
        ...detail,
        comment: { body: "Always on time.", moderation_status: "HIDDEN" },
      });
    }),
    http.get(api("/admin/evaluation-cycles/"), () =>
      HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
    ),
    http.get(api("/admin/criteria/"), () =>
      HttpResponse.json([
        {
          public_id: "k1",
          current_version: { name: "Attendance" },
        },
        {
          public_id: "k2",
          current_version: { name: "Vocal performance" },
        },
      ]),
    ),
    http.get(api("/admin/members/"), () =>
      HttpResponse.json({
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            public_id: "r1",
            first_name: "Rosa",
            last_name: "Reyes",
            display_name: "Rosa Reyes",
            username: "rosa",
            email: "rosa@example.com",
            role: "MEMBER",
            status: "ACTIVE",
          },
          {
            public_id: "e1",
            first_name: "Ernesto",
            last_name: "Cruz",
            display_name: "Ernesto Cruz",
            username: "ernesto",
            email: "ernesto@example.com",
            role: "MEMBER",
            status: "ACTIVE",
          },
        ],
      }),
    ),
  );
});

describe("All evaluations browser (ADM-02/03)", () => {
  it("shows who wrote each evaluation, warns that access is logged and filters via the URL", async () => {
    const { router } = renderRoute("/admin/evaluations?recipient=r1");
    const table = await screen.findByRole("table", { name: "Evaluations" });
    expect(within(table).getByText("Ernesto Cruz")).toBeVisible();
    expect(within(table).getByText("Attendance: 4/5")).toBeVisible();
    expect(
      screen.getByText(/every page you open here is recorded in the audit log/i),
    ).toBeVisible();
    expect(screen.getByText("About Rosa Reyes")).toBeVisible();
    expect(requests[0]?.search).toContain("recipient=r1");
    expect(screen.getByRole("link", { name: "Export as Excel" })).toHaveAttribute(
      "href",
      "/api/v1/admin/reports/export/?report=evaluations&file_type=xlsx&recipient=r1",
    );
    expect(screen.queryByRole("link", { name: "Export as PDF" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Rating to"), "2");
    await waitFor(() => {
      expect(router.state.location.search).toContain("rating_max=2");
    });
    expect(requests.at(-1)?.search).toContain("rating_max=2");
  });

  it("shows filter errors next to the filter", async () => {
    renderRoute("/admin/evaluations?rating_min=3&rating_max=1");
    expect(await screen.findByText("Must be at least the minimum.")).toBeVisible();
    expect(screen.getByText("Check the filters above.")).toBeVisible();
  });

  it("filters evaluations by evaluation type (all, member, self)", async () => {
    const { router } = renderRoute("/admin/evaluations");
    await screen.findByRole("table", { name: "Evaluations" });
    const user = userEvent.setup({ delay: null });

    const quickFilters = screen.getByLabelText("Evaluation type quick filters");
    await user.click(within(quickFilters).getByRole("button", { name: "Self-evaluations" }));
    await waitFor(() => {
      expect(router.state.location.search).toContain("evaluation_type=self");
    });

    await user.click(within(quickFilters).getByRole("button", { name: "Member evaluations" }));
    await waitFor(() => {
      expect(router.state.location.search).toContain("evaluation_type=peer");
    });

    await user.click(within(quickFilters).getByRole("button", { name: "All evaluations" }));
    await waitFor(() => {
      expect(router.state.location.search).not.toContain("evaluation_type");
    });
  });

  it("filters evaluations by member and criterion, isolates ratings, and clears filters", async () => {
    const { router } = renderRoute("/admin/evaluations");
    const table = await screen.findByRole("table", { name: "Evaluations" });
    expect(table).toBeVisible();

    // Check View button in table
    expect(screen.getByRole("link", { name: "View" })).toBeVisible();

    // Clear all filters button should be disabled initially
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeDisabled();

    // Select About member
    const aboutSelect = screen.getByLabelText("About (Member)");
    await userEvent.click(aboutSelect);
    const rosaOption = await screen.findByRole("option", { name: /Rosa Reyes/i });
    await userEvent.click(rosaOption);
    await waitFor(() => {
      expect(router.state.location.search).toContain("recipient=r1");
    });

    // Clear all filters button becomes enabled
    const clearBtn = screen.getByRole("button", { name: "Clear all filters" });
    expect(clearBtn).toBeEnabled();

    // Click Clear all filters
    await userEvent.click(clearBtn);
    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
  });

  it("isolates ratings to selected criterion and preserves filters on back navigation", async () => {
    const multiRatingDetail: AdminEvaluationDetail = {
      ...detail,
      ratings: [
        {
          criterion_public_id: "k1",
          criterion_name: "Attendance",
          criterion_version: 1,
          scale_type: "NUMERIC",
          max_value: 5,
          value: 4,
          label: "Very good",
        },
        {
          criterion_public_id: "k2",
          criterion_name: "Vocal performance",
          criterion_version: 1,
          scale_type: "NUMERIC",
          max_value: 5,
          value: 5,
          label: "Excellent",
        },
      ],
    };
    server.use(
      http.get(api("/admin/evaluations/"), () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [multiRatingDetail] }),
      ),
    );

    // Load with criterion=k2 filter
    renderRoute("/admin/evaluations?criterion=k2");
    const table = await screen.findByRole("table", { name: "Evaluations" });
    // Should ONLY show Vocal performance, NOT Attendance!
    expect(within(table).getByText("Vocal performance: 5/5")).toBeVisible();
    expect(within(table).queryByText("Attendance: 4/5")).not.toBeInTheDocument();

    // Click View to open evaluation detail
    const viewLink = within(table).getByRole("link", { name: "View" });
    expect(viewLink).toHaveAttribute("href", "/admin/evaluations/ev1?criterion=k2");
    await userEvent.click(viewLink);

    // Detail page loads
    expect(await screen.findByRole("heading", { name: "Evaluation of Rosa Reyes" })).toBeVisible();

    // Back button preserves filters
    const backLink = screen.getByRole("link", { name: "← All evaluations" });
    expect(backLink).toHaveAttribute("href", "/admin/evaluations?criterion=k2");
  });

  it("has an empty moderation queue state", async () => {
    renderRoute("/admin/moderation");
    expect(await screen.findByText("Nothing is waiting for review.")).toBeVisible();
  });
});

describe("Evaluation detail and moderation (ADM-05)", () => {
  it("shows identities, revisions with the editor and moderation history", async () => {
    renderRoute("/admin/evaluations/ev1");
    expect(await screen.findByRole("heading", { name: "Evaluation of Rosa Reyes" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ernesto Cruz" })).toHaveAttribute(
      "href",
      "/admin/members/e1",
    );
    const revs = await screen.findByRole("list", { name: "Revisions" });
    expect(within(revs).getByText(/Revision 2 .* by Ernesto Cruz/)).toBeVisible();
    expect(within(revs).getByText("Attendance: 3 → 4")).toBeVisible();
    // Revision content is directly visible without details arrow button
    expect(within(revs).getByText(/Revision 2 Content/i)).toBeVisible();
    expect(within(revs).getByText(/Always on time/i)).toBeVisible();
    expect(document.querySelector("details")).toBeNull();

    expect(screen.getByRole("list", { name: "Moderation history" })).toHaveTextContent(
      "Flagged the suggestion by Ana Admin — “Check tone”",
    );
    // A flagged text can be hidden or have its flag cleared.
    expect(screen.getByRole("button", { name: "Clear flag suggestion" })).toBeVisible();
  });

  it("displays self-evaluation header and all dynamic comments", async () => {
    const selfDetail: AdminEvaluationDetail = {
      ...detail,
      evaluator: recipient,
      is_self: true,
      comments: [
        {
          key: "prompt_1",
          label: "How did you do?",
          body: "I gave my best effort.",
          moderation_status: "VISIBLE",
        },
      ],
    };
    server.use(http.get(api("/admin/evaluations/ev-self/"), () => HttpResponse.json(selfDetail)));
    renderRoute("/admin/evaluations/ev-self");
    expect(
      await screen.findByRole("heading", { name: "Self-evaluation of Rosa Reyes" }),
    ).toBeVisible();
    expect(screen.getByText("How did you do?")).toBeVisible();
    expect(screen.getByText("I gave my best effort.")).toBeVisible();
  });

  it("requires a reason to hide, then hides the comment", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute("/admin/evaluations/ev1");
    await user.click(await screen.findByRole("button", { name: "Hide comment" }));
    const dialog = await screen.findByRole("dialog", { name: "Hide the comment?" });
    expect(within(dialog).getByText(/nothing is deleted/i)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Hide" }));
    expect(await within(dialog).findByText("Say why.")).toBeVisible();
    expect(requests.some((r) => r.path === "moderate")).toBe(false);

    await user.type(within(dialog).getByLabelText(/reason/i), "Personal remark");
    await user.click(within(dialog).getByRole("button", { name: "Hide" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(requests.find((r) => r.path === "moderate")?.body).toEqual({
      action: "HIDE",
      target: "COMMENT",
      reason: "Personal remark",
    });
    expect(await screen.findByRole("button", { name: "Restore comment" })).toBeVisible();
  });
});
