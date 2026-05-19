/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { strykerBase } from "./stryker-base.config.mjs";

// Scoped mutation testing — sync/git.ts + sqlite-bootstrap-helpers.ts only.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker-sync.config.mjs
// Or from repo root:
//   bun run test:mutants:sync
//
export default {
	...strykerBase,
	mutate: ["src/sync/git.ts", "src/sqlite-bootstrap-helpers.ts"],
	coverageAnalysis: "all",
	vitest: { related: false },
	reporters: ["clear-text", "json"],
	jsonReporter: { fileName: "../../reports/mutation/report-sync.json" },
	incremental: true,
	incrementalFile: "../../.stryker-incremental-sync.json",
	thresholds: { high: 95, low: 95, break: 95 },
};
