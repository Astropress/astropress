/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Full-suite mutation testing — mutates ALL source files.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker.config.mjs
// Or from repo root:
//   bun run test:mutants
//
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/persistence-types.ts",
    "!src/config-service-types.ts",
  ],
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  vitest: { related: false },
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: "../../reports/mutation/index.html" },
  jsonReporter: { fileName: "../../reports/mutation/report.json" },
  // inPlace: false (default) — mutate in a sandbox copy, not the real source.
  // A SIGKILLed run leaves sandbox dirs to sweep but never corrupts src/.
  incremental: true,
  incrementalFile: "../../.stryker-incremental.json",
  timeoutMS: 120000,
  // Static mutants (those evaluated at module-load) run the full test suite per
  // mutant — Stryker estimated ~86% of total time on the 2564 static mutants in
  // this codebase, pushing a single run past 6 hours. Skip them; behavioural
  // coverage of the same lines comes from non-static mutants.
  ignoreStatic: true,
  thresholds: { high: 95, low: 95, break: 95 },
};
