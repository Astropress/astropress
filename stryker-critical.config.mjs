/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Focused mutation testing — security-critical paths only.
// Fast enough to run during development (~5 min).
//
//   bun run test:mutants:critical
//
export default {
  mutate: [
    "packages/astropress/src/security-*.ts",
    "packages/astropress/src/runtime-admin-auth.ts",
    "packages/astropress/src/admin-action-utils.ts",
    "packages/astropress/src/api-middleware.ts",
    "packages/astropress/src/content-modeling.ts",
    "packages/astropress/src/admin-normalizers.ts",
  ],
  testRunner: "vitest",
  vitest: {
    configFile: "packages/astropress/vitest.config.ts",
  },
  reporters: ["clear-text"],
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  concurrency: 4,
  timeoutMS: 30000,
  thresholds: { high: 90, low: 70, break: 60 },
};
