// stryker-disable-file: data-only — shared base config consumed by sibling configs only; mutating it would alter ALL stryker invocations equivalently.
// audit-stryker-thresholds: shared-base — siblings spread this object and supply their own thresholds; the base intentionally omits them.

/**
 * Single source of truth for cross-config Stryker defaults. Sibling
 * configs (stryker.config.mjs, stryker-sync.config.mjs,
 * stryker-critical.config.mjs, stryker-pending-form.config.mjs,
 * stryker-audit-utils.config.mjs, stryker-shared-cache.config.mjs)
 * import this object and spread it; per-config overrides come last so
 * a sibling can still tighten timeouts or pick its own mutate-glob.
 *
 * Why this file exists: in May 2026 we discovered `stryker.config.mjs`
 * was missing `dryRunTimeoutMinutes` while `stryker-sync.config.mjs`
 * had it set to 15 — cold CI shards died at Stryker's 5-min default
 * even though the sibling config had already learned that lesson.
 * Putting the value here means a future "should this be 20 minutes?"
 * decision lands once, not six times.
 */
export const strykerBase = {
	plugins: ["@stryker-mutator/vitest-runner"],
	testRunner: "vitest",
	// disableTypeChecks: false prevents the preprocessor from re-parsing
	// already-instrumented ESM files, which would trigger duplicate-identifier
	// errors when two mutated files import each other (stryNS_* collision).
	disableTypeChecks: false,
	// 120s per-mutant. Picks up the network-bound integration verify tests
	// (10s outer timeout × 4 retries) and most slow SQLite migrations.
	timeoutMS: 120_000,
	// Cold CI shards have no `.stryker-incremental-<shard>.json` to start
	// from, so the initial vitest dry-run executes the full suite with
	// perTest coverage instrumentation. That exceeds Stryker's 5-minute
	// default. 15 is a long-enough ceiling for any reasonable cold start.
	dryRunTimeoutMinutes: 15,
	// inPlace: false (default) — mutate in a sandbox copy, not the real source.
	// A SIGKILLed run leaves sandbox dirs to sweep but never corrupts src/.
};
