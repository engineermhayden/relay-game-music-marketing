import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    headless: true,
    channel: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
