import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (step 6.1). Run them with `scripts/e2e.sh` from the repository root: it starts
 * an isolated stack (project "choir-eval-e2e", ports 5281/8011), seeds it, runs these specs in
 * the official Playwright image and removes the stack again. The specs run in order and share
 * that stack's data, so they are serial.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5281",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
