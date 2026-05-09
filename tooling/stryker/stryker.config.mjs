/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

// Full-suite mutation testing — mutates ALL source files.
// Run from packages/astropress/:
//   cd packages/astropress && node ../../node_modules/.bin/stryker run ../../stryker.config.mjs
// Or from repo root:
//   bun run test:mutants
//
export default {
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: [
		"src/**/*.ts",
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
	testRunner: "vitest",
	coverageAnalysis: "perTest",
	vitest: { related: false },
	reporters: ["clear-text", "html", "json"],
	htmlReporter: { fileName: "../../reports/mutation/index.html" },
	jsonReporter: { fileName: "../../reports/mutation/report.json" },
	// inPlace: false (default) — mutate in a sandbox copy, not the real source.
	// A SIGKILLed run leaves sandbox dirs to sweep but never corrupts src/.
	incremental: true,
	incrementalFile: "../../.stryker-incremental.json",
	timeoutMS: 120000,
	ignoreStatic: false,
	thresholds: { high: 95, low: 95, break: 95 },
};
