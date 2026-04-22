/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Focused mutation testing — security-critical paths only.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker-critical.config.mjs
// Or from repo root:
//   bun run test:mutants:critical
//
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "src/security-*.ts",
    "src/runtime-admin-auth.ts",
    "src/admin-action-utils.ts",
    "src/api-middleware.ts",
    "src/content-modeling.ts",
    "src/admin-normalizers.ts",
  ],
  testRunner: "vitest",
  coverageAnalysis: "all",
  vitest: { related: false },
  reporters: ["clear-text"],
  inPlace: true,
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  timeoutMS: 120000,
  thresholds: { high: 90, low: 70, break: 60 },
};
