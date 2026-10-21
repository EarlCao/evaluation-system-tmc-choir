import { expect, test } from "@playwright/test";

import { ADMIN, signedIn } from "./helpers";

/** AUD-03 / ADR-022: destructive acceptance checks run only on the isolated E2E stack. */
test("Super Admin deletes an entry and clears ordinary logs while retaining receipts", async ({
  browser,
  baseURL,
}) => {
  expect(process.env.E2E_ALLOW_AUDIT_DELETION).toBe("1");
  expect(baseURL).toBe("http://localhost:5281");
  const page = await signedIn(browser, ADMIN.identifier, ADMIN.password);
  await page.goto("/admin/audit");
  const table = page.getByRole("table", { name: "Audit log" });
  await expect(table).toBeVisible();
  const remove = table.getByRole("button", { name: /^Delete entry / }).first();
  await expect(remove).toBeVisible();
  const removedLabel = (await remove.getAttribute("aria-label")) ?? "";
  expect(removedLabel).toMatch(/^Delete entry \d+$/);
  await remove.click();
  const single = page.getByRole("dialog", { name: "Delete this audit entry?" });
  await expect(single.getByRole("button", { name: "Delete entry", exact: true })).toBeDisabled();
  await single.getByLabel("Reason for deletion").fill("Isolated E2E cleanup");
  await single.getByLabel("Your password").fill(ADMIN.password);
  await single.getByRole("button", { name: "Delete entry", exact: true }).click();
  await expect(page.getByText(/1 audit entry deleted/i)).toBeVisible();
  await expect(table.getByText("audit.entry.deleted")).toBeVisible();
  await expect(table.getByRole("button", { name: removedLabel, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear all logs", exact: true }).click();
  const bulk = page.getByRole("dialog", { name: "Clear all audit logs?" });
  await bulk.getByLabel("Reason for deletion").fill("Isolated E2E bulk cleanup");
  await bulk.getByLabel("Your password").fill(ADMIN.password);
  await expect(bulk.getByRole("button", { name: "Clear all logs" })).toBeDisabled();
  await bulk.getByLabel("Type DELETE ALL LOGS").fill("DELETE ALL LOGS");
  await bulk.getByRole("button", { name: "Clear all logs" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(table.getByText("audit.logs.cleared")).toBeVisible();
  await expect(table.getByText("audit.entry.deleted")).toBeVisible();
  await expect(table.getByRole("button", { name: /^Delete entry / })).toHaveCount(0);
});
