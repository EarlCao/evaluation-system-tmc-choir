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
});
