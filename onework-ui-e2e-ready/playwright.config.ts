import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    screenshot: "off",
    video: "off",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000
  },
  outputDir: "test-results"
});
