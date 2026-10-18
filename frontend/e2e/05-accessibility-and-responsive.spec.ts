import { expect, test } from "@playwright/test";

import { member, signedIn } from "./helpers";

/** NFR-05: keyboard navigation, labels, landmarks and 360px responsive layout. */
test("pages are keyboard-navigable, labelled and responsive at 360px width", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");

  // Skip link is first tab stop and points to #main
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute("href", "#main");

  // No horizontal scrollbar at 360px on /login
  const loginOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(loginOverflow).toBe(false);

  // Member layout at 360px
  const singer = member(1);
  const memberPage = await signedIn(browser, singer.identifier, singer.password);
  await memberPage.setViewportSize({ width: 360, height: 740 });
  await memberPage.goto("/app/members");
  await expect(memberPage.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(memberPage.locator("main#main")).toBeVisible();

  const memberOverflow = await memberPage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(memberOverflow).toBe(false);
});
