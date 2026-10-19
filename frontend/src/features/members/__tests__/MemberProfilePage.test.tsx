import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { MemberDetail } from "../types";

const other: MemberDetail = {
  public_id: "11111111-0000-4000-8000-000000000001",
  first_name: "Lena",
  last_name: "Voss",
  display_name: "",
  voice_section: { id: 2, name: "Alto" },
  bio: "Loves Bach.",
  joined_choir_on: "2019-09-01",
  is_self: false,
};

describe("MemberProfilePage", () => {
  it("shows another member's profile read-only", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api(`/members/${other.public_id}/`), () => HttpResponse.json(other)),
    );
    renderRoute(`/app/members/${other.public_id}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Lena Voss" })).toBeVisible();
    expect(screen.getByText("Alto")).toBeVisible();
    expect(screen.getByText("Loves Bach.")).toBeVisible();
    expect(screen.getByText("Member since 2019")).toBeVisible();
    expect(screen.queryByRole("button", { name: /save bio/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Evaluate Lena" })).toHaveAttribute(
      "href",
      `/app/members/${other.public_id}/evaluate`,
    );
  });

  it("lets members edit their own bio and shows Evaluate yourself link", async () => {
    const self = { ...other, is_self: true, bio: "" };
    let body: unknown;
    server.use(
      loggedInAs(memberUser),
      http.get(api(`/members/${self.public_id}/`), () => HttpResponse.json(self)),
      http.patch(api("/members/me/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...self, bio: "Second alto." });
      }),
    );
    renderRoute(`/app/members/${self.public_id}`);
    await userEvent.type(await screen.findByLabelText(/about you/i), "Second alto.");
    await userEvent.click(screen.getByRole("button", { name: /save bio/i }));
    expect(await screen.findByText("Your profile was saved.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: /evaluate yourself/i }).length).toBeGreaterThan(0);
    expect(body).toEqual({ bio: "Second alto.", is_officer: false, officer_position: "" });
  });

  it("displays another member's public self-evaluation ratings and comments", async () => {
    const withSelfEval: MemberDetail = {
      ...other,
      self_evaluation: {
        public_id: "self-ev-1",
        cycle: { public_id: "c1", name: "Spring 2026" },
        submitted_at: "2026-10-19T08:00:00Z",
        is_edited: false,
        ratings: [
          {
            criterion_version: 11,
            criterion_name: "Attendance",
            value: 5,
            label: "Excellent",
            min_value: 1,
            max_value: 5,
          },
        ],
        comment: "I always arrive 15 minutes early.",
        suggestion: "Working on high notes.",
        comments: [
          {
            key: "comment",
            label: "Comments (Unsay imong ikaingon sa akoa?)",
            body: "I always arrive 15 minutes early.",
          },
          {
            key: "suggestion",
            label: "Suggestions (Unsay imong ikasuggest sa akoa?)",
            body: "Working on high notes.",
          },
        ],
      },
    };
    server.use(
      loggedInAs(memberUser),
      http.get(api(`/members/${other.public_id}/`), () => HttpResponse.json(withSelfEval)),
    );
    renderRoute(`/app/members/${other.public_id}`);
    expect(
      await screen.findByRole("heading", { name: /Public Self-Evaluation & Comments/i }),
    ).toBeVisible();
    expect(screen.getByText("5 / 5 — Excellent")).toBeVisible();
    expect(screen.getByText("I always arrive 15 minutes early.")).toBeVisible();
    expect(screen.getByText("Working on high notes.")).toBeVisible();
  });

  it("treats unknown or inactive members as not found", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/members/missing/"), () =>
        HttpResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 }),
      ),
    );
    renderRoute("/app/members/missing");
    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeVisible();
  });
});
