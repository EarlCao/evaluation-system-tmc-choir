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

  it("lets members edit their own bio", async () => {
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
    expect(await screen.findByText("Your bio was saved.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /^evaluate/i })).not.toBeInTheDocument();
    expect(body).toEqual({ bio: "Second alto." });
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
