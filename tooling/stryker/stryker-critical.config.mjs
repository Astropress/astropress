/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { strykerBase } from "./stryker-base.config.mjs";

// Focused mutation testing — security-critical paths only.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker-critical.config.mjs
// Or from repo root:
//   bun run test:mutants:critical
//
export default {
	...strykerBase,
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
	coverageAnalysis: "all",
	vitest: { related: false },
	reporters: ["clear-text"],
	incremental: true,
	incrementalFile: ".stryker-incremental.json",
	thresholds: { high: 95, low: 95, break: 95 },
};
