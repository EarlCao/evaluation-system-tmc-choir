import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import { describeChanges } from "../revisions";
import type { CycleForm, MyEvaluation, Revision } from "../types";

const ID = "55555555-0000-4000-8000-000000000001";
const cycle = {
  public_id: "c1",
  name: "Spring concert",
  description: "",
  status: "OPEN" as const,
  starts_at: "2026-10-01T00:00:00Z",
  ends_at: "2026-11-30T00:00:00Z",
  edit_deadline: "2026-11-30T00:00:00Z",
  evaluation_scope: "ALL" as const,
  allow_resubmission: false,
};
const criterion = {
  id: 11,
  name: "Attendance",
  scale_type: "NUMERIC" as const,
  min_value: 1,
  max_value: 5,
  step: 1,
  labels: { "5": "Excellent" },
};
const evaluation: MyEvaluation = {
  public_id: ID,
  cycle,
  recipient: {
    public_id: "r1",
    first_name: "Lena",
    last_name: "Voss",
    display_name: "",
    voice_section: null,
  },
  submitted_at: "2026-10-17T10:00:00Z",
  last_edited_at: null,
  is_edited: false,
  current_revision_number: 1,
  ratings: [{ criterion_version: criterion, value: 3, label: "" }],
  comment: "First thoughts",
  suggestion: "",
  can_edit: true,
};
const form: CycleForm = {
  cycle,
  comment_required: true,
  suggestion_required: false,
  comment_max_length: 200,
  suggestion_max_length: 200,
  criteria: [
    {
      order: 1,
      criterion_version: 11,
      name: "Attendance",
      description: "",
      category: null,
      scale_type: "NUMERIC",
      min_value: 1,
      max_value: 5,
      step: 1,
      labels: { "5": "Excellent" },
      is_required: true,
    },
  ],
};
const snapshot = (value: string, comment: string) => ({
  form_version_id: 1,
  ratings: [{ criterion_version_id: 11, criterion: "Attendance", value, label: "" }],
  comment,
  suggestion: "",
});
const editor = { public_id: memberUser.public_id, first_name: "Mira", last_name: "Quell" };

let patched: unknown;
let revisions: Revision[];

beforeEach(() => {
  patched = undefined;
  revisions = [
    {
      revision_number: 1,
      created_at: "2026-10-17T10:00:00Z",
      editor,
      change_summary: "Submitted",
      snapshot: snapshot("3", "First thoughts"),
    },
  ];
  server.use(
    loggedInAs(memberUser),
    http.get(api(`/evaluations/mine/${ID}/`), () => HttpResponse.json(evaluation)),
    http.get(api(`/evaluations/mine/${ID}/revisions/`), () => HttpResponse.json(revisions)),
    http.get(api("/evaluation-cycles/c1/form/"), () => HttpResponse.json(form)),
    http.patch(api(`/evaluations/mine/${ID}/`), async ({ request }) => {
      patched = await request.json();
      revisions = [
        ...revisions,
        {
          revision_number: 2,
          created_at: "2026-10-17T11:00:00Z",
          editor,
          change_summary: "Fixed typo",
          snapshot: snapshot("5", "Second thoughts"),
        },
      ];
      return HttpResponse.json({
        ...evaluation,
        is_edited: true,
        current_revision_number: 2,
        ratings: [{ criterion_version: criterion, value: 5, label: "Excellent" }],
        comment: "Second thoughts",
      });
    }),
  );
});

describe("editing my evaluation (MINE-02..04)", () => {
  it("edits through review and saves a new revision", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/my-evaluations/${ID}`);
    await user.click(await screen.findByRole("button", { name: "Edit evaluation" }));
    await user.click(await screen.findByRole("button", { name: "5: Excellent" }));
    const comment = screen.getByLabelText("Comment");
    expect(comment).toHaveValue("First thoughts"); // pre-filled from the current content
    await user.clear(comment);
    await user.type(comment, "Second thoughts");
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(
      await screen.findByRole("heading", { name: /review your changes for lena voss/i }),
    ).toHaveFocus();
    await user.type(screen.getByLabelText(/what did you change/i), "Fixed typo");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Your changes were saved as revision 2.")).toBeVisible();
    expect(patched).toEqual({
      ratings: [{ criterion_version: 11, value: 5 }],
      comment: "Second thoughts",
      suggestion: "",
      change_summary: "Fixed typo",
    });
    const history = await screen.findByRole("list", { name: "Revisions" });
    expect(await within(history).findByText("Revision 2")).toBeVisible();
    expect(within(history).getByText("Attendance: 3 → 5")).toBeVisible();
    expect(within(history).getByText("Comment changed")).toBeVisible();
  });

  it("can cancel an edit", async () => {
    renderRoute(`/app/my-evaluations/${ID}`);
    await userEvent.click(await screen.findByRole("button", { name: "Edit evaluation" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Edit evaluation" })).toBeVisible();
    expect(patched).toBeUndefined();
  });

  it("explains when the edit window has closed", async () => {
    server.use(
      http.get(api(`/evaluations/mine/${ID}/`), () =>
        HttpResponse.json({ ...evaluation, can_edit: false }),
      ),
    );
    renderRoute(`/app/my-evaluations/${ID}`);
    expect(
      await screen.findByText("The edit window for this evaluation has closed."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit evaluation" })).not.toBeInTheDocument();
  });

  it("states that the history is private", async () => {
    renderRoute(`/app/my-evaluations/${ID}`);
    expect(
      await screen.findByText(/only you and the super admin can see this history/i),
    ).toBeVisible();
  });
});

describe("describeChanges", () => {
  it("lists rating and text changes", () => {
    const before = snapshot("3", "a");
    const after = { ...snapshot("5", "a"), suggestion: "new" };
    expect(describeChanges(before, after).map((c) => c.text)).toEqual([
      "Attendance: 3 → 5",
      "Suggestion changed",
    ]);
  });

  it("describes a cleared optional rating", () => {
    const before = snapshot("3", "a");
    const after = { ...before, ratings: [{ ...before.ratings[0]!, value: null }] };
    expect(describeChanges(before, after)[0]?.text).toBe("Attendance: 3 → not rated");
  });
});
