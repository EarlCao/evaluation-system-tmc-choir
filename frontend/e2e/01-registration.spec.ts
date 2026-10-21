import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";

import { ADMIN, logIn, signedIn } from "./helpers";

/** AUTH-01, AUTH-03, AUTH-05: register → Super Admin approves → member signs in. */
test("a new member registers, is approved and signs in", async ({ page, browser }) => {
  const password = "Harmony-and-Rhythm-2026"; // gitleaks:allow (throwaway e2e account)
  await page.goto("/register");
  await page.getByLabel("First name").fill("Nora");
  await page.getByLabel("Last name").fill("Newcomer");
  await page.getByLabel("Username").fill("nora_new");
  await page.getByLabel("Email").fill("nora@example.org");
  await page.getByLabel("Voice section").click();
  await page.getByRole("option", { name: "Alto" }).click();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("textbox", { name: "Confirm password" }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("6-digit OTP code")).toBeVisible();
  let otp = "";
  await expect
    .poll(async () => {
      const mailDir = process.env.E2E_MAIL_DIR ?? "/e2e-mail";
      for (const file of await readdir(mailDir)) {
        const message = await readFile(`${mailDir}/${file}`, "utf8");
        if (message.includes("nora@example.org")) {
          otp = /verification code is:\s*(\d{6})/.exec(message)?.[1] ?? "";
        }
      }
      return otp.length;
    })
    .toBe(6);
  await page.getByLabel("6-digit OTP code").fill(otp);
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText(/waiting for Super Admin approval/i)).toBeVisible();

  // Not approved yet: signing in is refused.
  await page.goto("/login");
  await page.getByLabel("Username or email").fill("nora_new");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/invalid credentials|not active/i)).toBeVisible();

  const admin = await signedIn(browser, ADMIN.identifier, ADMIN.password);
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.goto("/admin/members?status=PENDING");
  await admin.getByRole("link", { name: "Nora Newcomer" }).click();
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Active", { exact: true }).first()).toBeVisible();

  await logIn(page, "nora_new", password);
  await expect(page).toHaveURL(/\/app$/);
});
