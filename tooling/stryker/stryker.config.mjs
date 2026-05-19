/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { strykerBase } from "./stryker-base.config.mjs";

// Full-suite mutation testing — mutates ALL source files.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker.config.mjs
// Or from repo root:
//   bun run test:mutants
//
// When STRYKER_SHARD=a or =b is set, the mutate set is sharded
// alphabetically by source filename (a–m and n–z). Each shard runs
// independently with its own incremental cache key in CI, halving the
// wall-clock for the daily mutation-test workflow. Unset (or any other
// value) → full suite, identical to the historical behaviour.
const SHARD = process.env.STRYKER_SHARD ?? "";
const shardFilters =
	SHARD === "a"
		? ["!src/[n-zN-Z]*.ts", "!src/[n-zN-Z]*/**/*.ts"]
		: SHARD === "b"
			? ["!src/[a-mA-M]*.ts", "!src/[a-mA-M]*/**/*.ts"]
			: [];

export default {
	...strykerBase,
	mutate: [
		"src/**/*.ts",
		...shardFilters,
		"!src/**/*.d.ts",
		"!src/**/index.ts",
		"!src/persistence-types.ts",
		"!src/config-service-types.ts",
		// Pure-data manifest/wordlist/catalog files. Each top-level entry is
		// a static mutant, but the *values* (provider labels, marketing copy,
		// passphrase words) carry no behavioural contract — exhaustive
		// equality assertions would test "did we type the data correctly"
		// rather than catch real bugs. Behavioural accessors that read these
		// manifests live in their non-`-data` siblings and are mutation-tested
		// at ≥95%. Excluding here lines up with the in-file `stryker-disable-file`
		// intent markers that the runner doesn't honour as a real directive.
		"!src/admin-stub-catalog.ts",
		"!src/admin-ui-translation-keys.ts",
		"!src/api-routes-data.ts",
		"!src/app-host-targets-data.ts",
		"!src/access/action-registry-data.ts",
		"!src/data-service-targets-data.ts",
		"!src/deployment-matrix-data.ts",
		"!src/integration-manifest-data.ts",
		"!src/project-scaffold-passphrase-wordlist.ts",
		"!src/provider-targets-data.ts",
		"!src/site-settings.ts",
		"!src/admin-app-integration-data.ts",
		"!src/admin-page-models-access-data.ts",
		"!src/integrations/registry-data.ts",
		"!src/sqlite-admin-runtime-options.ts",
		"!src/sqlite-admin-runtime-wiring.ts",
		"!src/sqlite-bootstrap-seed-sql.ts",
		"!src/import/wordpress-xml-tags-data.ts",
		// Pure barrel files (only `export … from` lines) and pure type-declaration
		// files. Stryker produces zero mutants for these → absent from the report
		// → gate would mark UNSCORED. Honors the in-file `stryker-disable-file:
		// data-only` markers on each.
		"!src/integration.ts",
		"!src/integrations/domains.ts",
		"!src/platform-contracts-helpers.ts",
		"!src/runtime-admin-actions.ts",
		"!src/runtime-route-registry.ts",
	],
	coverageAnalysis: "perTest",
	// related:true matches prepush-mutation-gate.ts:293; stryker uses vitest's
	// --related to limit per-mutant test execution to files importing the
	// mutated source.
	vitest: { related: true },
	reporters: ["clear-text", "html", "json"],
	htmlReporter: { fileName: "../../reports/mutation/index.html" },
	jsonReporter: { fileName: "../../reports/mutation/report.json" },
	incremental: true,
	incrementalFile: SHARD
		? `../../.stryker-incremental-${SHARD}.json`
		: "../../.stryker-incremental.json",
	ignoreStatic: false,
	thresholds: { high: 95, low: 95, break: 95 },
};
