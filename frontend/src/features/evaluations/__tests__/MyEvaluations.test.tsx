import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { MyEvaluation } from "../types";

const evaluation: MyEvaluation = {
  public_id: "44444444-0000-4000-8000-000000000001",
  cycle: {
    public_id: "c1",
    name: "Spring concert",
    description: "",
    status: "OPEN",
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: "2026-11-30T00:00:00Z",
    edit_deadline: "2026-11-30T00:00:00Z",
    evaluation_scope: "ALL",
    allow_resubmission: false,
  },
  recipient: {
    public_id: "r1",
    first_name: "Lena",
    last_name: "Voss",
    display_name: "",
    voice_section: { id: 2, name: "Alto" },
  },
  submitted_at: "2026-10-17T10:00:00Z",
  last_edited_at: null,
  is_edited: true,
  current_revision_number: 2,
  ratings: [
    {
      criterion_version: {
        id: 11,
        name: "Attendance",
        scale_type: "NUMERIC",
        min_value: 1,
        max_value: 5,
        step: 1,
        labels: { "5": "Excellent" },
      },
      value: 5,
      label: "Excellent",
    },
  ],
  comment: "Always on time.",
  suggestion: "",
  can_edit: true,
};

describe("My evaluations", () => {
  it("lists the member's own evaluations", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/evaluations/mine/"), () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [evaluation] }),
      ),
    );
    renderRoute("/app/my-evaluations");
    const link = await screen.findByRole("link", { name: /lena voss/i });
    expect(link).toHaveAttribute("href", `/app/my-evaluations/${evaluation.public_id}`);
    expect(screen.getByText("Edited")).toBeVisible();
    expect(screen.getByText("Editable")).toBeVisible();
  });

  it("shows an empty state", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/evaluations/mine/"), () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );
    renderRoute("/app/my-evaluations");
    expect(await screen.findByText(/haven't submitted any evaluations yet/i)).toBeVisible();
  });

  it("shows one evaluation's content as text", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api(`/evaluations/mine/${evaluation.public_id}/`), () =>
        HttpResponse.json({ ...evaluation, comment: "<b>not bold</b>" }),
      ),
    );
    renderRoute(`/app/my-evaluations/${evaluation.public_id}`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your evaluation of Lena Voss" }),
    ).toBeVisible();
    expect(screen.getByText("5 / 5 · Excellent")).toBeVisible();
    expect(screen.getByText("<b>not bold</b>")).toBeVisible(); // rendered as text, never HTML
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByText(/sees this feedback without your name/i)).toBeVisible();
  });

  it("shows not found for evaluations that aren't yours", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/evaluations/mine/x/"), () =>
        HttpResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 }),
      ),
    );
    renderRoute("/app/my-evaluations/x");
    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeVisible();
  });
});
