/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Focused mutation testing — security-critical paths only.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker-critical.config.mjs
// Or from repo root:
//   bun run test:mutants:critical
//
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  // Patterns auto-include new files in the security-critical families rather
  // than relying on hand-maintained filenames. The post-security-cleanup branch
  // added auth-emergency-revoke-ops.ts, auth-repository-factory.ts, and
  // auth-repository-helpers.ts; the wildcards sweep them in automatically.
  mutate: [
    "src/security-*.ts",
    "src/auth-*.ts",
    "src/runtime-admin-*.ts",
    "src/admin-action-utils.ts",
    "src/api-middleware.ts",
    "src/content-modeling.ts",
    "src/admin-normalizers.ts",
  ],
  testRunner: "vitest",
  coverageAnalysis: "all",
  vitest: { related: false },
  reporters: ["clear-text"],
  // inPlace: false (default) — mutate in a sandbox copy, not the real source.
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  timeoutMS: 120000,
  thresholds: { high: 90, low: 70, break: 60 },
};
