/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { strykerBase } from "./stryker-base.config.mjs";

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
	...strykerBase,
	mutate: ["tooling/lib/audit-utils.ts"],
	coverageAnalysis: "all",
	vitest: {
		configFile: "packages/astropress/vitest.config.ts",
		related: false,
	},
	reporters: ["clear-text", "json"],
	jsonReporter: { fileName: "reports/mutation/audit-utils.json" },
	incremental: true,
	incrementalFile: ".stryker-incremental-audit-utils.json",
	// Single-file scope with a small unit-test suite — 60s is enough and
	// halves the base 120s ceiling for snappier cold runs.
	timeoutMS: 60_000,
	thresholds: { high: 95, low: 95, break: 95 },
};
