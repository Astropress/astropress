/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Scoped mutation testing — sync/git.ts + sqlite-bootstrap-helpers.ts only.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker-sync.config.mjs
// Or from repo root:
//   bun run test:mutants:sync
//
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "src/sync/git.ts",
    "src/sqlite-bootstrap-helpers.ts",
  ],
  testRunner: "vitest",
  coverageAnalysis: "all",
  // disableTypeChecks: false prevents the preprocessor from re-parsing already-
  // instrumented ESM files, which would trigger duplicate-identifier errors when
  // two mutated files import each other (stryNS_* collision).
  disableTypeChecks: false,
  vitest: { related: false },
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: "../../reports/mutation/report-sync.json" },
  inPlace: true,
  incremental: true,
  incrementalFile: "../../.stryker-incremental-sync.json",
  timeoutMS: 120000,
  dryRunTimeoutMinutes: 15,
  thresholds: { high: 80, low: 60, break: 50 },
};
