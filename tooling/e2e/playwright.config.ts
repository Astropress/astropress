import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
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
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-mobile-iphonese",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-mobile-galaxys5",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
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
    // audit-playwright: local-only — Firefox isn't installed in the CI
    // image. Run manually with `npx playwright test --project=admin-harness-firefox`.
    {
      name: "admin-harness-firefox",
      testMatch: /admin-harness-accessibility\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-crud",
      testMatch: /admin-harness-crud\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-negative-paths",
      testMatch: /admin-harness-negative-paths\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-harness-smoke",
      testMatch: /admin-harness-smoke\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-cross-browser-chromium",
      testMatch: /admin-cross-browser-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-cross-browser-firefox",
      testMatch: /admin-cross-browser-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-cross-browser-webkit",
      testMatch: /admin-cross-browser-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        browserName: "webkit",
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "viewport-375",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        viewport: { width: 375, height: 812 },
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-touch-targets",
      testMatch: /admin-touch-targets\.spec\.ts/,
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-heading-hierarchy",
      testMatch: /admin-heading-hierarchy\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-interaction-timing",
      testMatch: /admin-interaction-timing\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "admin-perf-timing",
      testMatch: /admin-perf-timing\.spec\.ts/,
      retries: 1,
      use: {
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "viewport-768",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        viewport: { width: 768, height: 1024 },
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
    {
      name: "viewport-1280",
      testMatch: /admin-harness-mobile\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
        baseURL: process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4325",
      },
    },
  ],
});
