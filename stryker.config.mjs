/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Full-suite mutation testing — mutates ALL source files.
// Weekly CI runs the full suite. Developers can run focused subsets:
//
//   bun run test:mutants                          # full suite (CI default)
//   bun run test:mutants:critical                 # security/auth/API only (~5 min)
//   bun run test:mutants:file -- --mutate 'packages/astropress/src/my-file.ts'
//
export default {
  mutate: [
    "packages/astropress/src/**/*.ts",
    "!packages/astropress/src/**/*.d.ts",
    "!packages/astropress/src/**/index.ts",        // barrel re-exports, no logic
    "!packages/astropress/src/persistence-types.ts", // pure type file
    "!packages/astropress/src/config-service-types.ts", // pure type file
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
  timeoutMS: 60000,
  thresholds: { high: 80, low: 60, break: 50 },
};
