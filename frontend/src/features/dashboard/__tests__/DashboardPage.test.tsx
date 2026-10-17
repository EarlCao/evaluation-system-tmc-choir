import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { loggedInAs, memberUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("DashboardPage", () => {
  it("greets the member and shows their numbers and shortcuts", async () => {
    server.use(loggedInAs(memberUser));
    renderRoute("/app");
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Mira" })).toBeVisible();
    expect(await screen.findByText("Active choir members")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("Tenor")).toBeVisible();
    expect(screen.getByRole("link", { name: /browse members/i })).toHaveAttribute(
      "href",
      "/app/members",
    );
  });

  it("marks the current page in the main navigation", async () => {
    server.use(loggedInAs(memberUser));
    renderRoute("/app/members");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Members");
  });
});
