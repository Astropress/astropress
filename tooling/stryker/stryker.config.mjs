/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

import { globSync } from "node:fs";
import { strykerBase } from "./stryker-base.config.mjs";

// Full-suite mutation testing — mutates ALL source files.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker.config.mjs
// Or from repo root:
//   bun run test:mutants
//
// When STRYKER_SHARD=a|b|c|d is set, the mutate set is sharded into N
// balanced parts by round-robin over the *sorted* source-file list. Each
// shard runs independently with its own incremental cache key in CI.
//
// Why round-robin instead of the old alphabetic a–m / n–z buckets: Stryker
// wall-clock is dominated by how slow the tests covering a mutated file are
// (perTest + vitest `related:true`), NOT by file count or LOC. The handful
// of source files whose mutants drag in the network-bound integration-verify
// suite (120s timeoutMS × retries) and the heavy SQLite-migration tests all
// happened to sort into the a–m bucket, so shard "a" ran cold for 6h+ and
// was killed by GitHub's hard 6-hour per-job ceiling — before it could push
// its refreshed incremental cache, leaving the next run just as cold (a doom
// loop that surfaced as a recurring "cancelled" Mutation Testing run on main).
// Round-robin interleaves those expensive files across every shard, and N=4
// keeps even a fully-cold shard well under the 6h ceiling. Unset (or any
// other value) → full suite, identical to the historical behaviour.
const SHARD_NAMES = ["a", "b", "c", "d"];
const SHARD = process.env.STRYKER_SHARD ?? "";
const shardIndex = SHARD_NAMES.indexOf(SHARD);
let shardFilters = [];
if (shardIndex >= 0) {
	const shardCount = SHARD_NAMES.length;
	// globSync runs with cwd = the Stryker project root (packages/astropress),
	// so paths come back as "src/…", matching the mutate base glob below.
	// Sort for a stable, host-independent assignment; exclude every file that
	// does not belong to this shard. The data-only / barrel exclusions below
	// still apply on top, so a file assigned to this shard that is also a
	// global exclusion stays excluded everywhere (no double-mutation).
	const allSources = globSync("src/**/*.ts")
		.filter((file) => !file.endsWith(".d.ts"))
		.sort();
	shardFilters = allSources
		.filter((_file, index) => index % shardCount !== shardIndex)
		.map((file) => `!${file}`);
}

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
