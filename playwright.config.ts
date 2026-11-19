import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/database";

// Browser tests: real clicks through the main journeys on a production build,
// in Chrome sized like a phone, against their own database (tripstack_e2e,
// reset with the demo data each run). `npm run test:e2e`; see README → Testing.

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const database = e2eDatabaseUrl();

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One shared database and login rate limits: one test at a time keeps runs predictable
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    // Chrome as installed on the machine (GitHub's runners have it too): nothing to download
    channel: "chrome",
    locale: "en-GB",
    timezoneId: "Europe/London",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "phone",
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    // In CI the build step has already run; locally, build first so the tests see what users get
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    // E2E_REUSE_SERVER=1: use a server already running on the port (quicker when writing tests)
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    stdout: "pipe",
    env: {
      DATABASE_URL: database,
      DIRECT_URL: database,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "e2e-only-not-a-real-secret-0123456789abcdef",
      // Optional services off: emails print to the server log, no Claude, no Google button
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      CRON_SECRET: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
