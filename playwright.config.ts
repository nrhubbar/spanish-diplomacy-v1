import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "build/e2e/test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "build/e2e/playwright-report" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    screenshot: "on",
    trace: "on"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173/assets/",
    reuseExistingServer: !process.env["CI"]
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
