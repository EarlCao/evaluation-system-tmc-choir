import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("WelcomePage", () => {
  it("shows the product, entry points and a live API status", async () => {
    renderRoute("/");
    expect(
      screen.getByRole("heading", { level: 1, name: /choir member evaluation system/i }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(await screen.findByText("API online")).toBeVisible();
  });

  it("reports when the API is unavailable", async () => {
    server.use(
      http.get(api("/health/"), () =>
        HttpResponse.json({ status: "error", db: "error" }, { status: 503 }),
      ),
    );
    renderRoute("/");
    expect(await screen.findByText("API unavailable")).toBeVisible();
  });
});
