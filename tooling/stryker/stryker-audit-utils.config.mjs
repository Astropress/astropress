/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Scoped mutation testing — tooling/lib/audit-utils.ts.
//
// The shared framework underlies 36 audit scripts; a regression here cascades.
// The Vitest suite in packages/astropress/tests/audit-utils.test.ts is the
// primary harness. CI integration (all 36 audits passing) is the belt; this
// config is the suspenders.
//
// Run: bun run test:mutants:audit-utils
//
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ["tooling/lib/audit-utils.ts"],
  testRunner: "vitest",
  coverageAnalysis: "all",
  vitest: {
    configFile: "packages/astropress/vitest.config.ts",
    related: false,
  },
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: "reports/mutation/audit-utils.json" },
  // inPlace: false (default) — mutate in a sandbox copy, not the real source.
  incremental: true,
  incrementalFile: ".stryker-incremental-audit-utils.json",
  timeoutMS: 60000,
  thresholds: { high: 95, low: 95, break: 95 },
};
