import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the demo organization (remote Supabase project).
 * Global setup re-seeds the demo org, so runs are repeatable.
 *
 *   npm run build && npm run test:e2e
 *   PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npm run test:e2e   # against a deployment
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Vercel deployment protection bypass for previews, when provided.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
