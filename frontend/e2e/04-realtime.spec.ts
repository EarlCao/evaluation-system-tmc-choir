import { expect, test } from "@playwright/test";

import { ADMIN, member, signedIn } from "./helpers";

/** RT-01, RT-03: closing the period reaches a signed-in member live over WebSocket. */
test("members are notified live when the period closes", async ({ browser }) => {
  const singer = member(3);
  const page = await signedIn(browser, singer.identifier, singer.password);
  const bell = page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toBeVisible();
  const unread = async () =>
    Number(/(\d+) unread/.exec((await bell.getAttribute("aria-label")) ?? "")?.[1] ?? 0);
  const before = await unread();

  const admin = await signedIn(browser, ADMIN.identifier, ADMIN.password);
  await admin.goto("/admin/cycles");
  await admin.getByRole("link", { name: "Demo cycle" }).click();
  await admin.getByRole("button", { name: "Close period" }).click();
  await admin
    .getByRole("dialog", { name: "Close this period?" })
    .getByRole("button", { name: "Close period" })
    .click();

  // No reload: the WebSocket push updates the badge.
  await expect.poll(unread, { timeout: 15_000 }).toBe(before + 1);
  await bell.click();
  await expect(page.getByRole("dialog", { name: "Notifications" })).toContainText(
    "Evaluation period “Demo cycle” is closed.",
  );
});
