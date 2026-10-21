import { expect, type Browser, type Page } from "@playwright/test";

/** Accounts created by scripts/e2e.sh in the throwaway e2e stack (never a real database). */
export const ADMIN = {
  identifier: "e2e-admin@example.org",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};
export const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? "";
export const member = (n: number) => ({
  identifier: `demo${String(n).padStart(2, "0")}`,
  name: `Demo${String(n).padStart(2, "0")} Singer`,
  password: MEMBER_PASSWORD,
});

export async function logIn(page: Page, identifier: string, password: string) {
  await page.goto(identifier === ADMIN.identifier ? "/admin/login" : "/login");
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A separate browser context per person, like separate devices. */
export async function signedIn(browser: Browser, identifier: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logIn(page, identifier, password);
  return page;
}
