/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { strykerBase } from "./stryker-base.config.mjs";

// Scoped mutation testing — tooling/lib pending-form component only.
// Harness: tests/web-components/pending-form.test.ts (9 unit tests).
//
// Run: bun run test:mutants:pending-form
//
export default {
	...strykerBase,
	mutate: ["web-components/pending-form.ts"],
	coverageAnalysis: "all",
	vitest: { related: false },
	reporters: ["clear-text", "json"],
	jsonReporter: { fileName: "../../reports/mutation/pending-form.json" },
	inPlace: true,
	incremental: true,
	incrementalFile: "../../.stryker-incremental-pending-form.json",
	// Web-component suite is tiny (9 unit tests) — 30s is plenty and tighter
	// than the 120s base, so we override downward.
	timeoutMS: 30_000,
	thresholds: { high: 95, low: 95, break: 95 },
};
