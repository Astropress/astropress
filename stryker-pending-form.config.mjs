/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Scoped mutation testing — tooling/lib pending-form component only.
// Harness: tests/web-components/pending-form.test.ts (9 unit tests).
//
// Run: bun run test:mutants:pending-form
//
export default {
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: ["web-components/pending-form.ts"],
	testRunner: "vitest",
	coverageAnalysis: "all",
	vitest: { related: false },
	reporters: ["clear-text", "json"],
	jsonReporter: { fileName: "../../reports/mutation/pending-form.json" },
	inPlace: true,
	incremental: true,
	incrementalFile: "../../.stryker-incremental-pending-form.json",
	timeoutMS: 30000,
	thresholds: { high: 90, low: 80, break: 70 },
};
