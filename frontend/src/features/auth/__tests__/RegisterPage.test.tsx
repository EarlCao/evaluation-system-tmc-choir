import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const SECTIONS = [
  { id: 1, name: "Soprano" },
  { id: 2, name: "Alto" },
  { id: 3, name: "Tenor" },
  { id: 4, name: "Bass" },
];

beforeEach(() => {
  server.use(http.get(api("/members/voice-sections/"), () => HttpResponse.json(SECTIONS)));
});

async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    first: "Nova",
    last: "Singer",
    username: "nova_q1",
    email: "nova@example.org",
    password: "Sing-Loud-And-Clear-1", // gitleaks:allow (fake test password)
    confirm: "Sing-Loud-And-Clear-1",
    ...overrides,
  };
  const user = userEvent.setup({ delay: null });
  await user.type(await screen.findByLabelText(/first name/i), values.first);
  await user.type(screen.getByLabelText(/last name/i), values.last);
  await user.type(screen.getByLabelText(/^username/i), values.username);
  await user.type(screen.getByLabelText(/^email/i), values.email);
  await user.click(screen.getByRole("combobox", { name: /voice section/i }));
  await user.click(
    within(await screen.findByRole("listbox")).getByRole("option", { name: "Alto" }),
  );
  await user.type(screen.getByLabelText(/^password/i, { selector: "input" }), values.password);
  await user.type(
    screen.getByLabelText(/confirm password/i, { selector: "input" }),
    values.confirm,
  );
  return user;
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /create account/i }));

describe("RegisterPage", () => {
  it("submits the registration and explains the approval step", async () => {
    let body: unknown;
    server.use(
      http.post(api("/members/register/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            status: "PENDING",
            detail: "Your account was created and is waiting for Super Admin approval.",
          },
          { status: 201 },
        );
      }),
    );
    renderRoute("/register");
    await submit(await fillForm());

    expect(await screen.findByText(/waiting for super admin approval/i)).toBeVisible();
    expect(body).toEqual({
      first_name: "Nova",
      last_name: "Singer",
      username: "nova_q1",
      email: "nova@example.org",
      voice_section: 2,
      password: "Sing-Loud-And-Clear-1", // gitleaks:allow (fake test password)
    });
  });

  it("checks that passwords match and are long enough", async () => {
    renderRoute("/register");
    await submit(await fillForm({ password: "short", confirm: "different" }));
    expect(
      await screen.findByText(/at least 8 characters/i, { selector: "p.Mui-error" }),
    ).toBeVisible();
    expect(screen.getByText("The passwords don't match.")).toBeVisible();
  });

  it("puts server field errors next to the right input", async () => {
    server.use(
      http.post(api("/members/register/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Please correct the highlighted fields.",
              fields: { email: ["An account with this email already exists."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderRoute("/register");
    await submit(await fillForm());
    expect(await screen.findByText("An account with this email already exists.")).toBeVisible();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a closed-registration message", async () => {
    server.use(
      http.post(api("/members/register/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "business_rule_violation",
              message: "Registration is currently closed.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderRoute("/register");
    await submit(await fillForm());
    expect(await screen.findByRole("alert")).toHaveTextContent("Registration is currently closed.");
  });

  it("rejects uppercase letters or disallowed characters in username", async () => {
    renderRoute("/register");
    await submit(await fillForm({ username: "Nova_Q1" }));
    expect(
      await screen.findByText(
        "Use only lowercase letters (a-z), numbers (0-9), and underscores (_).",
      ),
    ).toBeVisible();
  });

  it("verifies email with a 6-digit OTP code after creating an account", async () => {
    let verifyBody: unknown;
    server.use(
      http.post(api("/members/register/"), () =>
        HttpResponse.json(
          {
            status: "PENDING",
            detail: "We sent a 6-digit OTP verification code to your email.",
          },
          { status: 201 },
        ),
      ),
      http.post(api("/auth/verify-email/"), async ({ request }) => {
        verifyBody = await request.json();
        return HttpResponse.json({
          detail: "Your email address is confirmed. You can now log in.",
        });
      }),
    );
    renderRoute("/register");
    const user = await fillForm();
    await submit(user);

    const otpInput = await screen.findByLabelText(/6-digit otp code/i);
    await user.type(otpInput, "654321");
    await user.click(screen.getByRole("button", { name: /verify otp/i }));

    expect(await screen.findByText(/your email address is confirmed/i)).toBeVisible();
    expect(verifyBody).toEqual({ email: "nova@example.org", otp: "654321" });
  });
});
