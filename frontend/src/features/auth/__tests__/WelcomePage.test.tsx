import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRoute } from "@/test/render";

describe("WelcomePage (root / Member Login)", () => {
  it("renders purely the Member Login form at / with Forgot password and Create account (no API status)", async () => {
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
    expect(screen.queryByText(/api online/i)).not.toBeInTheDocument();
  });
});


