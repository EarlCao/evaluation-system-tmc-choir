import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { DirectoryMember } from "../types";

const people: DirectoryMember[] = Array.from({ length: 45 }, (_, i) => ({
  public_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  first_name: `First${String(i)}`,
  last_name: `Last${String(i)}`,
  display_name: i === 0 ? "Nick" : "",
  voice_section: { id: (i % 4) + 1, name: ["Soprano", "Alto", "Tenor", "Bass"][i % 4]! },
}));

let requests: URLSearchParams[] = [];

beforeEach(() => {
  requests = [];
  server.use(
    loggedInAs(memberUser),
    http.get(api("/members/"), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const search = params.get("search")?.toLowerCase() ?? "";
      const section = params.get("voice_section");
      const page = Number(params.get("page") ?? "1");
      const matching = people.filter(
        (p) =>
          (!search || `${p.first_name} ${p.last_name}`.toLowerCase().includes(search)) &&
          (!section || String(p.voice_section.id) === section),
      );
      return HttpResponse.json({
        count: matching.length,
        next: null,
        previous: null,
        results: matching.slice((page - 1) * 20, page * 20),
      });
    }),
  );
});

const cards = () => within(screen.getByRole("list", { name: "Members" })).getAllByRole("listitem");

describe("MemberDirectoryPage", () => {
  it("lists members with name and voice section", async () => {
    renderRoute("/app/members");
    expect(await screen.findByText("Nick (First0 Last0)")).toBeVisible();
    expect(cards()).toHaveLength(20);
    expect(screen.getByText("45 members")).toBeVisible();
    expect(screen.getByRole("link", { name: /nick \(first0 last0\)/i })).toHaveAttribute(
      "href",
      `/app/members/${people[0]!.public_id}`,
    );
  });

  it("searches (debounced) and keeps the search in the URL", async () => {
    const { router } = renderRoute("/app/members");
    await screen.findByText("Nick (First0 Last0)");
    await userEvent.type(screen.getByLabelText(/search by name/i), "first12");
    expect(await screen.findByText("First12 Last12")).toBeVisible();
    await waitFor(() => {
      expect(cards()).toHaveLength(1);
    });
    expect(router.state.location.search).toContain("search=first12");
    expect(requests.at(-1)?.get("search")).toBe("first12");
  });

  it("filters by voice section", async () => {
    renderRoute("/app/members");
    await screen.findByText("Nick (First0 Last0)");
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /voice section/i }));
    await user.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "Bass" }),
    );
    await waitFor(() => {
      expect(requests.at(-1)?.get("voice_section")).toBe("4");
    });
    expect(await screen.findByText("11 members")).toBeVisible();
  });

  it("paginates", async () => {
    const { router } = renderRoute("/app/members");
    await screen.findByText("Nick (First0 Last0)");
    await userEvent.click(screen.getByRole("button", { name: /go to page 3/i }));
    expect(await screen.findByText("First40 Last40")).toBeVisible();
    expect(router.state.location.search).toContain("page=3");
  });

  it("shows an empty state", async () => {
    renderRoute("/app/members?search=nobody");
    expect(await screen.findByText("No members match your search.")).toBeVisible();
  });

  it("shows a retryable error", async () => {
    server.use(http.get(api("/members/"), () => new HttpResponse(null, { status: 500 })));
    renderRoute("/app/members");
    expect(await screen.findByText("We couldn't load the member list.")).toBeVisible();
  });

  it("displays green Evaluated badge and View evaluation button for evaluated members during an open cycle", async () => {
    server.use(
      http.get(api("/evaluation-cycles/current/"), () =>
        HttpResponse.json({
          cycle: {
            public_id: "cycle-1",
            name: "Concert 2026",
            status: "OPEN",
            ends_at: "2026-12-31T00:00:00Z",
          },
        }),
      ),
      http.get(api("/members/"), () =>
        HttpResponse.json({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              public_id: "member-1",
              first_name: "Alice",
              last_name: "Song",
              display_name: "",
              voice_section: { id: 1, name: "Soprano" },
              is_evaluated: true,
              evaluation_id: "eval-alice-123",
            },
            {
              public_id: "member-2",
              first_name: "Bob",
              last_name: "Chant",
              display_name: "",
              voice_section: { id: 2, name: "Alto" },
              is_evaluated: false,
              evaluation_id: null,
            },
          ],
        }),
      ),
    );

    renderRoute("/app/members");
    expect(await screen.findByText("Alice Song")).toBeVisible();
    expect(screen.getByText("Bob Chant")).toBeVisible();

    // Alice is evaluated -> has green "Evaluated" chip and "View evaluation" button
    expect(screen.getByText("Evaluated")).toBeVisible();
    const aliceBtn = screen.getByRole("link", { name: /view evaluation/i });
    expect(aliceBtn).toBeVisible();
    expect(aliceBtn).toHaveAttribute("href", "/app/my-evaluations/eval-alice-123");

    // Bob is not evaluated -> has "Evaluate" button and no "Evaluated" chip
    const bobBtn = screen.getByRole("link", { name: "Evaluate" });
    expect(bobBtn).toBeVisible();
    expect(bobBtn).toHaveAttribute("href", "/app/members/member-2/evaluate");
  });

  it("filters by evaluation status (haven't evaluated yet vs completed)", async () => {
    const { router } = renderRoute("/app/members");
    await screen.findByText("Nick (First0 Last0)");
    const user = userEvent.setup();

    const quickFilters = screen.getByLabelText("Evaluation status quick filters");

    // Click "Haven't evaluated / comments yet" chip
    await user.click(
      within(quickFilters).getByRole("button", { name: "Haven't evaluated / comments yet" }),
    );
    await waitFor(() => {
      expect(requests.at(-1)?.get("evaluation_status")).toBe("pending");
    });
    expect(router.state.location.search).toContain("evaluation_status=pending");

    // Click "Completed" chip
    await user.click(within(quickFilters).getByRole("button", { name: "Completed" }));
    await waitFor(() => {
      expect(requests.at(-1)?.get("evaluation_status")).toBe("completed");
    });
    expect(router.state.location.search).toContain("evaluation_status=completed");

    // Click "All" chip
    await user.click(within(quickFilters).getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(router.state.location.search).not.toContain("evaluation_status");
    });
  });
});
