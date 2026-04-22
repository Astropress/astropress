// @ts-nocheck
// 
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/persistence-types.ts",
    "!src/config-service-types.ts",
    "!src/transactional-email.ts",
  ],
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  vitest: { related: false },
  ignoreStatic: true,
  reporters: ["clear-text"],
  inPlace: true,
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  timeoutMS: 120000,
  thresholds: { high: 80, low: 60, break: 0 },
};
