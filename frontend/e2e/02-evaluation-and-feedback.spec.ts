import { expect, test } from "@playwright/test";

import { member, signedIn } from "./helpers";

const COMMENT = "Your phrasing in the second verse was beautiful.";

/** EVAL-01..07, FB-01, Privacy Model: evaluate → recipient sees the text, never the author. */
test("a member evaluates another, who sees the feedback anonymously", async ({ browser }) => {
  const author = member(1);
  const recipient = member(2);

  const page = await signedIn(browser, author.identifier, author.password);
  await page.goto("/app/members");
  await page.getByRole("link", { name: recipient.name }).click();
  await page.getByRole("link", { name: /^Evaluate / }).click();

  // One "4: Good" button per criterion (wait for the form: .all() does not wait).
  const fours = page.getByRole("button", { name: /^4: / });
  await expect(fours.first()).toBeVisible();
  for (const button of await fours.all()) {
    await button.click();
  }
  await page.getByRole("button", { name: /next.*comment/i }).click();
  await page.getByLabel(/1\. Comments/).fill(COMMENT);
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Who can see your evaluation")).toBeVisible();
  await page.getByRole("button", { name: "Submit evaluation" }).click();
  await expect(page.getByText(/was submitted/i)).toBeVisible();

  await page.goto("/app/my-evaluations");
  await expect(page.getByText(recipient.name).first()).toBeVisible();

  const theirs = await signedIn(browser, recipient.identifier, recipient.password);
  await theirs.goto("/app/feedback");
  await expect(theirs.getByText(COMMENT)).toBeVisible();
  // The author is never revealed: not by name, username or anywhere in the page.
  const text = (await theirs.locator("body").innerText()).toLowerCase();
  expect(text).not.toContain(author.name.toLowerCase());
  expect(text).not.toContain(author.identifier);
});
