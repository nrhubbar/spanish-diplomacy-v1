import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets a long-running dev server be reused across runs (and lets parallel
// checkouts avoid each other's servers).
const port = Number(process.env["E2E_PORT"] ?? "5173");
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "build/e2e/test-results",
  // Three times Playwright's defaults: the tests share the CPU with each other, on hosts of any
  // speed, and a longer limit only lengthens a test that would fail.
  timeout: 90_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "build/e2e/playwright-report" }]
  ],
  snapshotPathTemplate: "e2e/baselines/{projectName}/{arg}{ext}",
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.002, threshold: 0.2 }
  },
  use: {
    baseURL: `${baseURL}/assets/`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${String(port)} --strictPort --mode e2e`,
    url: `${baseURL}/assets/`,
    reuseExistingServer: !process.env["CI"]
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { height: 800, width: 1440 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { height: 800, width: 1440 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { height: 800, width: 1440 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] } }
  ]
});
