import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { ChoirSummary, MemberSummary, ParticipationReport } from "../types";

const scale = { type: "NUMERIC" as const, min: 1, max: 5, step: 1 };
const choir: ChoirSummary = {
  threshold: 3,
  totals: { evaluations: 4, evaluators: 3, recipients: 3 },
  criteria: [
    {
      criterion: "Attendance",
      criterion_public_id: "k1",
      version: 1,
      scale,
      rated: 4,
      not_rated: 0,
      suppressed: false,
      average: 3.5,
      average_percent: 62.5,
    },
    {
      criterion: "Blend",
      criterion_public_id: "k2",
      version: 1,
      scale,
      rated: 2,
      not_rated: 2,
      suppressed: true,
      average: null,
      average_percent: null,
    },
  ],
  voice_sections: [
    {
      id: 1,
      name: "Soprano",
      evaluations: 3,
      recipients: 2,
      evaluators: 3,
      suppressed: false,
      average_percent: 70,
    },
    {
      id: 4,
      name: "Bass",
      evaluations: 1,
      recipients: 1,
      evaluators: 1,
      suppressed: true,
      average_percent: null,
    },
  ],
  trend: [
    {
      cycle: { public_id: "c1", name: "Spring" },
      evaluations: 4,
      evaluators: 3,
      suppressed: false,
      average_percent: 62.5,
    },
  ],
};
const participation: ParticipationReport = {
  cycle: { public_id: "c2", name: "Autumn", status: "OPEN", evaluation_scope: "ALL" },
  totals: {
    possible_pairs: 20,
    submitted_pairs: 5,
    participating_members: 4,
    participation_percent: 25,
  },
  members: [
    {
      public_id: "m1",
      first_name: "Sara",
      last_name: "Santos",
      voice_section: "Soprano",
      is_evaluable: true,
      possible: 4,
      given: 2,
      received: 3,
      percent: 50,
    },
  ],
};
const member: MemberSummary = {
  member: {
    public_id: "m1",
    first_name: "Sara",
    last_name: "Santos",
    voice_section: "Soprano",
    status: "ACTIVE",
  },
  evaluations_received: 2,
  evaluations_given: 2,
  criteria: [{ ...choir.criteria[0]!, rated: 2, suppressed: false }],
  trend: choir.trend,
};
const cycle = (id: string, name: string, status: string) => ({
  public_id: id,
  name,
  status,
  description: "",
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: "2026-11-01T00:00:00Z",
  edit_deadline: "2026-11-01T00:00:00Z",
  form_version: null,
  allow_resubmission: false,
  evaluation_scope: "ALL",
  feedback_visibility: "IMMEDIATE",
  opened_at: null,
  closed_at: null,
  created_at: "2026-09-01T00:00:00Z",
});

let searches: string[];

beforeAll(async () => {
  await import("../pages/ReportsPage");
  await import("../pages/MemberReportPage");
});

beforeEach(() => {
  searches = [];
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/reports/choir/"), ({ request }) => {
      searches.push(new URL(request.url).search);
      return HttpResponse.json(choir);
    }),
    http.get(api("/admin/reports/participation/"), ({ request }) => {
      searches.push(new URL(request.url).search);
      return HttpResponse.json(participation);
    }),
    http.get(api("/admin/reports/members/m1/"), () => HttpResponse.json(member)),
    http.get(api("/admin/evaluation-cycles/"), () =>
      HttpResponse.json({
        count: 2,
        next: null,
        previous: null,
        results: [cycle("c1", "Spring", "CLOSED"), cycle("c2", "Autumn", "OPEN")],
      }),
    ),
    http.get(api("/admin/criteria/"), () => HttpResponse.json([])),
  );
});

describe("Choir summary (REP-01/03/04/06)", () => {
  it("shows averages, hides small groups and explains the numbers", async () => {
    renderRoute("/admin/reports");
    const criteria = await screen.findByRole("table", { name: "Criteria" });
    const attendance = within(criteria).getByText("Attendance").closest("tr")!;
    expect(attendance).toHaveTextContent("3.5 / 5");
    expect(within(attendance).getByRole("meter")).toHaveAttribute("aria-valuenow", "62.5");
    const blend = within(criteria).getByText("Blend").closest("tr")!;
    expect(within(blend).getAllByText("Hidden: too few")).toHaveLength(2);
    const sections = screen.getByRole("table", { name: "Voice sections" });
    expect(within(sections).getByText("Bass").closest("tr")).toHaveTextContent("Hidden: too few");
    expect(screen.getByText(/never as zero/i)).toBeVisible();
    expect(screen.getByText(/fewer than 3 members are hidden/i)).toBeVisible();
  });

  it("filters through the URL and exports with the same filters", async () => {
    const { router } = renderRoute("/admin/reports?voice_section=1");
    await screen.findByRole("table", { name: "Criteria" });
    expect(searches[0]).toBe("?voice_section=1");
    expect(screen.getByRole("link", { name: "Export as PDF" })).toHaveAttribute(
      "href",
      "/api/v1/admin/reports/export/?report=choir&file_type=pdf&voice_section=1",
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Period" }));
    await userEvent.click(await screen.findByRole("option", { name: "Spring" }));
    await waitFor(() => {
      expect(router.state.location.search).toContain("cycle=c1");
    });
    expect(screen.getByRole("link", { name: "Export as CSV" }).getAttribute("href")).toContain(
      "cycle=c1",
    );
  });
});

describe("Participation (REP-01/04)", () => {
  it("defaults to the open period and links to member reports", async () => {
    renderRoute("/admin/reports?view=participation");
    const table = await screen.findByRole("table", { name: "Participation by member" });
    expect(searches.at(-1)).toBe("?cycle=c2");
    expect(within(table).getByText("2 / 4")).toBeVisible();
    expect(within(table).getByRole("link", { name: "Sara Santos" })).toHaveAttribute(
      "href",
      "/admin/reports/members/m1",
    );
    expect(screen.getByText(/5 of 20 possible evaluations · 4 members took part/)).toBeVisible();
    expect(screen.getByText(/shows member names/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Export as Excel" })).toHaveAttribute(
      "href",
      "/api/v1/admin/reports/export/?report=participation&file_type=xlsx&cycle=c2",
    );
  });
});

describe("Member report (REP-01/02)", () => {
  it("shows the member's aggregates and links to the evaluations browser", async () => {
    renderRoute("/admin/reports/members/m1");
    expect(await screen.findByRole("heading", { name: "Report: Sara Santos" })).toBeVisible();
    expect(screen.getByText(/2 evaluations received · 2 given/)).toBeVisible();
    expect(screen.getByRole("link", { name: /evaluations about them/i })).toHaveAttribute(
      "href",
      "/admin/evaluations?recipient=m1",
    );
    expect(screen.getByRole("link", { name: "Export as PDF" })).toHaveAttribute(
      "href",
      "/api/v1/admin/reports/export/?report=member&file_type=pdf&member=m1",
    );
  });
});
