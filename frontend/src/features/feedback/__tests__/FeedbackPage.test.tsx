import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { FeedbackItem, FeedbackSummary } from "../types";

const spring = { public_id: "c-spring", name: "Spring concert" };
const autumn = { public_id: "c-autumn", name: "Autumn concert" };

const summary: FeedbackSummary = {
  evaluations_received: 7,
  threshold: 3,
  criteria: [
    {
      criterion: "Attendance",
      criterion_public_id: "k1",
      scale: { type: "NUMERIC", min: 1, max: 5, step: 1 },
      n: 7,
      suppressed: false,
      average: 4.1,
      distribution: { "3": 2, "4": 2, "5": 3 },
    },
    {
      criterion: "Solo work",
      criterion_public_id: "k2",
      scale: { type: "NUMERIC", min: 1, max: 5, step: 1 },
      n: 2,
      suppressed: true,
      average: null,
      distribution: null,
    },
  ],
  trend: [
    { cycle: spring, evaluations: 2, suppressed: true, average_percent: null },
    { cycle: autumn, evaluations: 5, suppressed: false, average_percent: 78.5 },
  ],
};

const items: FeedbackItem[] = [
  {
    feedback_id: "AAAAAAAAAAAAAAAA",
    cycle: autumn,
    date: "2026-10-12",
    is_edited: true,
    comment: "Your blend in the chorale was lovely.",
    suggestion: "Watch the tempo in bar 30.",
  },
  {
    feedback_id: "BBBBBBBBBBBBBBBB",
    cycle: autumn,
    date: "2026-10-13",
    is_edited: false,
    comment: "<script>alert(1)</script>",
    suggestion: "",
  },
];

let listRequests: URLSearchParams[] = [];
let summaryRequests: URLSearchParams[] = [];

beforeEach(() => {
  listRequests = [];
  summaryRequests = [];
  server.use(
    loggedInAs(memberUser),
    http.get(api("/feedback/received/summary/"), ({ request }) => {
      summaryRequests.push(new URL(request.url).searchParams);
      return HttpResponse.json(summary);
    }),
    http.get(api("/feedback/received/"), ({ request }) => {
      listRequests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ count: items.length, next: null, previous: null, results: items });
    }),
  );
});

describe("FeedbackPage", () => {
  it("explains anonymity and who can see identities (FB-06)", async () => {
    renderRoute("/app/feedback");
    expect(await screen.findByText("This feedback is anonymous to you")).toBeVisible();
    expect(
      screen.getByText(/the super admin can see who submitted each evaluation/i),
    ).toBeVisible();
  });

  it("shows the count, averages and a suppressed criterion", async () => {
    renderRoute("/app/feedback");
    expect(await screen.findByText("Evaluations received")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    const meter = screen.getByRole("meter", { name: "Attendance average" });
    expect(meter).toHaveAttribute("aria-valuenow", "4.1");
    expect(meter).toHaveAttribute("aria-valuetext", "4.1 out of 5");
    expect(screen.getByText("Average of 7 ratings")).toBeVisible();
    expect(
      screen.getByText(/not enough evaluations yet to show an average \(shown from 3\)/i),
    ).toBeVisible();
    expect(screen.queryByRole("meter", { name: "Solo work average" })).not.toBeInTheDocument();
  });

  it("offers the trend as a table, with suppressed periods left out", async () => {
    renderRoute("/app/feedback");
    const table = await screen.findByRole("table", {
      name: /average rating per evaluation period/i,
    });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Spring concert2Not enough evaluations");
    expect(rows[2]).toHaveTextContent("Autumn concert579%");
    expect(screen.getByRole("img", { name: /1 evaluation period/i })).toBeInTheDocument();
  });

  it("lists comments as plain text with the Edited label", async () => {
    renderRoute("/app/feedback");
    const list = await screen.findByRole("list", { name: "Feedback" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Your blend in the chorale was lovely.")).toBeVisible();
    expect(screen.getByText("Edited")).toBeVisible();
    expect(screen.getByText("<script>alert(1)</script>")).toBeVisible(); // text, never HTML
    expect(document.querySelector("li script")).toBeNull();
  });

  it("filters everything by evaluation period", async () => {
    renderRoute("/app/feedback");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("combobox", { name: /evaluation period/i }));
    await user.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "Autumn concert" }),
    );
    await waitFor(() => {
      expect(summaryRequests.at(-1)?.get("cycle")).toBe("c-autumn");
      expect(listRequests.at(-1)?.get("cycle")).toBe("c-autumn");
    });
    expect(
      screen.queryByRole("table", { name: /average rating per evaluation period/i }),
    ).toBeNull();
  });

  it("filters comments by date", async () => {
    renderRoute("/app/feedback");
    const from = await screen.findByLabelText("Comments from");
    await userEvent.type(from, "2026-10-13");
    await waitFor(() => {
      expect(listRequests.at(-1)?.get("date_from")).toBe("2026-10-13");
    });
  });

  it("shows an empty state", async () => {
    server.use(
      http.get(api("/feedback/received/"), () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );
    renderRoute("/app/feedback");
    expect(await screen.findByText("No comments or suggestions yet.")).toBeVisible();
  });

  it("is reachable from the main navigation", async () => {
    renderRoute("/app/feedback");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Feedback");
  });
});
