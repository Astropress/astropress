/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    "packages/astropress/src/security-*.ts",
    "packages/astropress/src/runtime-admin-auth.ts",
    "packages/astropress/src/admin-action-utils.ts",
    "packages/astropress/src/runtime-actions-content.ts",
    "packages/astropress/src/api-middleware.ts",
    "packages/astropress/src/content-modeling.ts",
  ],
  testRunner: "vitest",
  vitest: {
    configFile: "packages/astropress/vitest.config.ts",
  },
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/report.json" },
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  concurrency: 4,
  timeoutMS: 30000,
  thresholds: { high: 80, low: 60, break: 50 },
};
