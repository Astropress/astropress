// audit-stryker-thresholds: cache-refresh-only
import baseConfig from "./stryker.config.mjs";

// Refresh-only config used by run-mutants-shared in the
// `Mutation Testing > Stryker (TypeScript)` CI job that pushes the
// shared `.stryker-incremental.json` cache to the `stryker-state`
// branch. Quality is enforced separately by:
//   * mutation-gate job (prepush-mutation-gate --check-only) — per-file
//     baseline regression check on every PR + main push.
//   * audit:baseline-coverage / audit:baseline-floor — main-branch
//     audits that block any baseline drop or new-file-below-floor.
// The break threshold here is 0 so a global score below 95% does not
// fail the cache refresh — it would otherwise mask successful per-file
// gates with a misleading aggregate that the codebase has not yet met.
export default { ...baseConfig, thresholds: { high: 95, low: 95, break: 0 } };
