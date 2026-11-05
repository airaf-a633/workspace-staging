import { defineConfig } from "@playwright/test";

/**
 * Browser tests (decided 2026-11-01). Two suites:
 *  - preview: the design preview, no database needed (always runnable);
 *  - live: a real workspace on the staging database, signed in as the seed people. Needs staging awake and
 *    E2E_LIVE=1. The worker must be running for anything that sends.
 * They drive the installed Microsoft Edge so nothing large is downloaded.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", channel: "msedge", trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "preview", testMatch: /preview\..*\.spec\.ts/ },
    { name: "live", testMatch: /live\..*\.spec\.ts/ },
  ],
});
