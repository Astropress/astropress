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
  coverageAnalysis: "all",
  vitest: { related: false },
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: "../../reports/mutation/index.html" },
  jsonReporter: { fileName: "../../reports/mutation/report.json" },
  // inPlace: false (default) — mutate in a sandbox copy, not the real source.
  // A SIGKILLed run leaves sandbox dirs to sweep but never corrupts src/.
  incremental: true,
  incrementalFile: "../../.stryker-incremental.json",
  timeoutMS: 120000,
  thresholds: { high: 80, low: 60, break: 50 },
};
