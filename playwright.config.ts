import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and a real (staging) Convex + Clerk
 * pair. By default they start the app on :3000 (`next dev` locally, `next
 * start` in CI, after a build); set E2E_BASE_URL to test a deployed one.
 */
const external = process.env.E2E_BASE_URL;
const ci = Boolean(process.env.CI);
const PORT = 3000;

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: ci,
  // One worker: the specs share staging data and per-user rate limits.
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  retries: ci ? 1 : 0,
  testDir: "tests/e2e",
  timeout: 90_000,
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command: `npm run ${ci ? "start" : "dev"} -- --port ${PORT}`,
        reuseExistingServer: !ci,
        timeout: 180_000,
        url: `http://localhost:${PORT}`,
      },
  workers: 1,
});
