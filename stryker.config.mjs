/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Full-suite mutation testing — mutates ALL source files.
// Uses the command runner to work with Bun-managed node_modules.
//
//   bun run test:mutants                          # full suite (CI default)
//   bun run test:mutants:critical                 # security/auth/API only (~5 min)
//   bun run test:mutants:file -- --mutate 'packages/astropress/src/my-file.ts'
//
export default {
  mutate: [
    "packages/astropress/src/**/*.ts",
    "!packages/astropress/src/**/*.d.ts",
    "!packages/astropress/src/**/index.ts",
    "!packages/astropress/src/persistence-types.ts",
    "!packages/astropress/src/config-service-types.ts",
  ],
  testRunner: "command",
  commandRunner: {
    command: "cd packages/astropress && npx vitest run --reporter=dot",
  },
  coverageAnalysis: "off",
  ignorePatterns: [
    "crates/target",
    ".git",
    "dist",
    ".astro",
    "coverage",
    "test-results",
    "playwright-report",
    ".data",
    "reports",
    "examples/*/dist",
    "examples/*/.astro",
    "packages/docs/dist",
    "packages/docs/.astro",
  ],
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/report.json" },
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  timeoutMS: 120000,
  thresholds: { high: 80, low: 60, break: 50 },
};
