import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright-tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "example-a11y",
      testMatch: /example-accessibility\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_EXAMPLE_BASE_URL ?? "http://127.0.0.1:4173",
      },
    },
    {
      name: "admin-harness-a11y",
      testMatch: /admin-harness-accessibility\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-mobile",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-mobile-iphonese",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        ...devices["iPhone SE"],
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-mobile-galaxys5",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        ...devices["Galaxy S5"],
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-a11y-interactions",
      testMatch: /admin-harness-interactions\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
  ],
});
