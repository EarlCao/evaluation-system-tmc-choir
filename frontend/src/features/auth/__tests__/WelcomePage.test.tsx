import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("WelcomePage (root / Member Login)", () => {
  it("renders the Member Login form at / with Forgot password, Create account, and live API status", async () => {
    renderRoute("/");
    expect(await screen.findByRole("heading", { level: 1, name: /^log in$/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /forgot your password/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
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

