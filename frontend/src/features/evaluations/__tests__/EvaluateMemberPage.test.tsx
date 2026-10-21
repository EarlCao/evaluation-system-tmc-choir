import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { CycleForm, Eligibility, MyEvaluation } from "../types";

const RECIPIENT = "22222222-0000-4000-8000-000000000001";
const CYCLE = "33333333-0000-4000-8000-000000000001";

const cycle = {
  public_id: CYCLE,
  name: "Spring concert",
  description: "",
  status: "OPEN" as const,
  starts_at: "2026-10-01T00:00:00Z",
  ends_at: "2026-11-30T00:00:00Z",
  edit_deadline: "2026-11-30T00:00:00Z",
  evaluation_scope: "ALL" as const,
  allow_resubmission: false,
};

const form: CycleForm = {
  cycle,
  comment_required: true,
  suggestion_required: false,
  comment_max_length: 40,
  suggestion_max_length: 200,
  criteria: [
    {
      order: 1,
      criterion_version: 11,
      name: "Attendance",
      description: "Comes on time.",
      category: "Commitment",
      scale_type: "NUMERIC",
      min_value: 1,
      max_value: 5,
      step: 1,
      labels: { "1": "Needs improvement", "5": "Excellent" },
      is_required: true,
    },
    {
      order: 2,
      criterion_version: 12,
      name: "Solo work",
      description: "",
      category: null,
      scale_type: "PERCENT",
      min_value: 0,
      max_value: 100,
      step: 5,
      labels: {},
      is_required: false,
    },
  ],
};

const eligible: Eligibility = {
  can_evaluate: true,
  reason: null,
  message: null,
  existing_evaluation: null,
};

let submitted: unknown;

function setup(eligibility: Eligibility = eligible) {
  submitted = undefined;
  server.use(
    loggedInAs(memberUser),
    http.get(api(`/members/${RECIPIENT}/`), () =>
      HttpResponse.json({
        public_id: RECIPIENT,
        first_name: "Lena",
        last_name: "Voss",
        display_name: "",
        voice_section: { id: 2, name: "Alto" },
        bio: "",
        joined_choir_on: null,
        is_self: false,
      }),
    ),
    http.get(api("/members/"), () =>
      HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
    ),
    http.get(api("/evaluations/eligibility/"), () => HttpResponse.json(eligibility)),
    http.get(api("/evaluation-cycles/current/"), () => HttpResponse.json({ cycle })),
    http.get(api(`/evaluation-cycles/${CYCLE}/form/`), () => HttpResponse.json(form)),
    http.post(api("/evaluations/"), async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json({ public_id: "ev-1" } as Partial<MyEvaluation>, { status: 201 });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  setup();
});

describe("EvaluateMemberPage", () => {
  it("renders the cycle's criteria with accessible rating controls", async () => {
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Evaluate Lena Voss" }),
    ).toBeVisible();
    const attendance = await screen.findByRole("group", { name: "Attendance" });
    expect(screen.getByText("Rating Scale Guide & Explanations")).toBeVisible();
    expect(screen.getByText("5 — Excellent")).toBeVisible();
    expect(screen.getByText("1 — Needs Improvement")).toBeVisible();
    expect(
      screen.getByText("Scale reference: 1 = Needs improvement · 5 = Excellent"),
    ).toBeVisible();
    expect(within(attendance).getByRole("button", { name: "5: Excellent" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Solo work (optional)" })).toBeVisible();
    expect(screen.getByRole("slider")).toBeVisible();
  });

  it("validates required ratings on step 1 and required comment on step 2 before review", async () => {
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await userEvent.click(await screen.findByRole("button", { name: "Next: Comments" }));
    expect(await screen.findByText("Rate “Attendance”.")).toBeVisible();
    expect(submitted).toBeUndefined();

    await userEvent.click(await screen.findByRole("button", { name: "4" }));
    await userEvent.click(screen.getByRole("button", { name: "Next: Comments" }));
    expect(
      await screen.findByLabelText(/1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(
      await screen.findByText("Comments (Unsay imong ikaingon sa akoa?) is required."),
    ).toBeVisible();
    expect(submitted).toBeUndefined();
  });

  it("steps through criteria, numbered comments, and review with the privacy notice, then submits", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await user.click(await screen.findByRole("button", { name: "4" }));
    expect(screen.getByText("You chose 4.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));

    const commentInput = await screen.findByLabelText(
      /1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i,
    );
    const suggestionInput = screen.getByLabelText(
      /2\. Suggestions \(Unsay imong ikasuggest sa akoa\?\)/i,
    );
    await user.type(commentInput, "Steady and reliable");
    await user.type(suggestionInput, "Try the solo");
    expect(screen.getAllByText(/3 words · Write as many words as you want/i)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Review" }));

    const heading = await screen.findByRole("heading", { name: /review your evaluation/i });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Who can see your evaluation")).toBeVisible();
    expect(await screen.findByText(/super admin can see it/i)).toBeVisible();
    expect(screen.getByText("4 / 5")).toBeVisible();
    expect(screen.getByText("Not rated")).toBeVisible(); // optional criterion skipped
    expect(screen.queryByText(/mentions your own name/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit evaluation" }));
    expect(await screen.findByText(/your evaluation of lena voss was submitted/i)).toBeVisible();
    expect(submitted).toEqual({
      recipient: RECIPIENT,
      ratings: [
        { criterion_version: 11, value: 4 },
        { criterion_version: 12, value: null },
      ],
      comment: "Steady and reliable",
      suggestion: "Try the solo",
      comments: {
        comment: "Steady and reliable",
        suggestion: "Try the solo",
        comment_3: "",
        comment_4: "",
        comment_5: "",
      },
    });
  });

  it("warns, without blocking, when the comment is signed with the writer's own name", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));
    await user.type(
      await screen.findByLabelText(/1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i),
      "Lovely tone. From Mira",
    );
    expect(await screen.findByText(/mentions your own name \(Mira\)/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("heading", { name: /review your evaluation/i });
    expect(screen.getByText(/mentions your own name/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit evaluation" })).toBeEnabled();
  });

  it("returns to the form with server field errors (draft kept)", async () => {
    server.use(
      http.post(api("/evaluations/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Please correct the highlighted fields.",
              fields: { ratings: { "11": ["Choose a value from 1 to 5 in steps of 1."] } },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));
    await user.type(
      await screen.findByLabelText(/1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i),
      "Kept text",
    );
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Submit evaluation" }));

    expect(await screen.findByText("Choose a value from 1 to 5 in steps of 1.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));
    expect(
      await screen.findByLabelText(/1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i),
    ).toHaveValue("Kept text");
  });

  it("shows business-rule conflicts on the review step", async () => {
    server.use(
      http.post(api("/evaluations/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "business_rule_violation",
              message: "The evaluation period has ended.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));
    await user.type(
      await screen.findByLabelText(/1\. Comments \(Unsay imong ikaingon sa akoa\?\)/i),
      "Ok",
    );
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Submit evaluation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The evaluation period has ended.");
  });

  it("explains why a member can't be evaluated and links to the existing evaluation", async () => {
    setup({
      can_evaluate: false,
      reason: "ALREADY_EVALUATED",
      message: "You already evaluated this member in this period.",
      existing_evaluation: "ev-9",
    });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    expect(await screen.findByText(/already evaluated this member/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open your evaluation" })).toHaveAttribute(
      "href",
      "/app/my-evaluations/ev-9",
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Next: Comments" })).not.toBeInTheDocument();
    });
  });

  it("allows members to add an extra comment, and delete it with confirmation modal", async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Next: Comments" }));

    // Add another comment
    const addButton = await screen.findByRole("button", { name: "+ Add another comment" });
    await user.click(addButton);

    // Prompt 6 should now be visible
    const extraInput = await screen.findByLabelText(/6\. Additional comment/i);
    expect(extraInput).toBeVisible();
    await user.type(extraInput, "Special note for this member");

    // Click Remove comment button
    const removeButton = screen.getByRole("button", { name: "Remove comment" });
    await user.click(removeButton);

    // Confirmation dialog opens
    const dialog = await screen.findByRole("dialog", { name: "Remove Comment" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText(/are you sure you want to remove/i)).toBeVisible();

    // Clicking cancel preserves the comment
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove Comment" })).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/6\. Additional comment/i)).toHaveValue(
      "Special note for this member",
    );

    // Click remove again and confirm deletion
    await user.click(screen.getByRole("button", { name: "Remove comment" }));
    const confirmDialog = await screen.findByRole("dialog", { name: "Remove Comment" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Remove" }));

    // Dialog closes and extra comment field is removed
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove Comment" })).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/6\. Additional comment/i)).not.toBeInTheDocument();
  });

  it("warns about unsaved progress when clicking Back to members and restores saved draft", async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderRoute(`/app/members/${RECIPIENT}/evaluate`);

    // Top "Back to members" button is visible
    const backBtn = await screen.findByRole("link", { name: "Back to members" });
    expect(backBtn).toBeVisible();

    // Fill in a rating
    await user.click(await screen.findByRole("button", { name: "4" }));

    // Click "Back to members" -> blocker opens warning dialog
    await user.click(backBtn);
    const dialog = await screen.findByRole("dialog", { name: "Unsaved Evaluation Progress" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText(/You have unsaved ratings or comments/i)).toBeVisible();

    // "Stay & Continue" keeps the user on the evaluation form
    await user.click(within(dialog).getByRole("button", { name: /stay & continue/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Unsaved Evaluation Progress" }),
      ).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe(`/app/members/${RECIPIENT}/evaluate`);

    // Click back again, and choose "Save Draft & Leave"
    await user.click(backBtn);
    const saveDialog = await screen.findByRole("dialog", { name: "Unsaved Evaluation Progress" });
    await user.click(within(saveDialog).getByRole("button", { name: /save draft & leave/i }));

    // Router proceeds away from the page
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app/members");
    });

    // When the member returns to evaluate the same member, the draft is restored!
    renderRoute(`/app/members/${RECIPIENT}/evaluate`);
    expect(await screen.findByText(/draft restored/i)).toBeVisible();
    expect(await screen.findByRole("button", { name: "4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
