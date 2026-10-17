import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const GENERIC = "If an account exists for this email, a reset link has been sent.";

describe("ForgotPasswordPage", () => {
  it("always shows the same confirmation", async () => {
    let body: unknown;
    server.use(
      http.post(api("/auth/password-reset/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ detail: GENERIC }, { status: 202 });
      }),
    );
    renderRoute("/forgot-password");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "someone@example.org");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(GENERIC)).toBeVisible();
    expect(body).toEqual({ email: "someone@example.org" });
  });
});

describe("ResetPasswordPage", () => {
  async function submitNewPassword(password = "Brand-New-Chorus-77") {
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/^new password/i, { selector: "input" }),
      password,
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i, { selector: "input" }),
      password,
    );
    await user.click(screen.getByRole("button", { name: /save new password/i }));
  }

  it("sends uid + token from the link and confirms success", async () => {
    let body: unknown;
    server.use(
      http.post(api("/auth/password-reset/confirm/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ detail: "Your password has been reset. You can now log in." });
      }),
    );
    renderRoute("/reset-password/MQ/abc-123");
    await submitNewPassword();
    expect(await screen.findByText(/your password has been reset/i)).toBeVisible();
    expect(body).toEqual({ uid: "MQ", token: "abc-123", new_password: "Brand-New-Chorus-77" });
  });

  it("explains expired links", async () => {
    server.use(
      http.post(api("/auth/password-reset/confirm/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "This link is invalid or has expired.",
              fields: { token: ["This link is invalid or has expired."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderRoute("/reset-password/MQ/used");
    await submitNewPassword();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This link is invalid or has expired.",
    );
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeVisible();
  });
});

describe("VerifyEmailPage", () => {
  it("only verifies after an explicit click", async () => {
    let calls = 0;
    server.use(
      http.post(api("/auth/verify-email/"), () => {
        calls += 1;
        return HttpResponse.json({
          detail: "Your email address is confirmed. You can now log in.",
        });
      }),
    );
    renderRoute("/verify-email/MQ/tok");
    const button = await screen.findByRole("button", { name: /confirm my email/i });
    expect(calls).toBe(0);
    await userEvent.click(button);
    expect(await screen.findByText(/your email address is confirmed/i)).toBeVisible();
    expect(calls).toBe(1);
  });
});
