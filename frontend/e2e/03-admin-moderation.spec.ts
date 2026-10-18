import { expect, test } from "@playwright/test";

import { ADMIN, member, signedIn } from "./helpers";

/** ADM-02, ADM-03, ADM-05: the Super Admin sees the author and hides the comment. */
test("the Super Admin sees who wrote it and hides the comment", async ({ browser }) => {
  const author = member(1);
  const recipient = member(2);

  const admin = await signedIn(browser, ADMIN.identifier, ADMIN.password);
  await admin.goto("/admin/evaluations");
  await expect(admin.getByText(/recorded in the audit log/i).first()).toBeVisible();
  const table = admin.getByRole("table", { name: "Evaluations" });
  await expect(table.getByText(author.name)).toBeVisible();
  await table
    .getByRole("link", { name: `Open the evaluation of ${recipient.name} by ${author.name}` })
    .click();

  await admin.getByRole("button", { name: "Hide comment" }).click();
  const dialog = admin.getByRole("dialog", { name: "Hide the comment?" });
  await dialog.getByLabel(/reason/i).fill("e2e moderation check");
  await dialog.getByRole("button", { name: "Hide" }).click();
  await expect(admin.getByRole("button", { name: "Restore comment" })).toBeVisible();

  // The access and the decision are in the audit log.
  await admin.goto("/admin/audit?search=admin.sensitive_access");
  await expect(admin.getByRole("table", { name: "Audit log" })).toContainText(
    "admin.sensitive_access",
  );

  const theirs = await signedIn(browser, recipient.identifier, recipient.password);
  await theirs.goto("/app/feedback");
  await expect(theirs.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(theirs.getByText("Your phrasing in the second verse")).toHaveCount(0);
});
