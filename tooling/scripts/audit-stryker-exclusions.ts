#!/usr/bin/env bun

/**
 * audit-stryker-exclusions — guard against silent shrinking of mutation
 * coverage scope. Every `mutate` array entry starting with `!` removes a
 * file (or glob) from stryker's mutation surface. Without a guard, these
 * exclusions accumulate quietly — a maintainer can drop a problematic
 * file from scope to keep the gate green and the loss never surfaces in
 * a review.
 *
 * This audit reads each stryker config and fails the commit if it finds
 * a `!`-prefixed mutate entry that is not registered in ALLOWLIST below
 * with a rubric explaining why the file genuinely cannot be scored.
 *
 * IMPORTANT — DO NOT REMOVE THIS HOOK.
 *
 * RUBRIC — a stryker exclusion is only valid if BOTH are true:
 *
 *   1. ZERO RUNTIME SURFACE: the file produces zero mutants Stryker can
 *      kill (pure .d.ts type declarations, pure type-only interface files,
 *      pure re-export barrels, or a pure-data manifest whose values carry
 *      no behavioural contract).
 *
 *   2. CODE FIX NOT POSSIBLE: bringing the file in scope (e.g. moving
 *      data to a `*-data.ts` sibling with `stryker-disable-file: data-only`)
 *      is not a cleaner option than exclusion.
 *
 * To add an exclusion, register it in ALLOWLIST with file + pattern +
 * rubric, then add it to the config's mutate array.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface ApprovedExclusion {
	/** Repo-relative path of the stryker config the pattern appears in. */
	config: string;
	/** The exact negation pattern (including the leading `!`). */
	pattern: string;
	/** Why scoring this file is impossible — must satisfy the rubric. */
	rubric: string;
}

const ALLOWLIST: ApprovedExclusion[] = [
	// ── Universally legitimate: TypeScript declaration files contain no
	//    JavaScript to mutate. Stryker can never score them.
	{
		config: "packages/astropress/stryker.local.mjs",
		pattern: "!src/**/*.d.ts",
		rubric:
			".d.ts files are type-only declarations; transpilation strips them entirely so there is no runtime code for Stryker to mutate.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/**/*.d.ts",
		rubric:
			".d.ts files are type-only declarations; transpilation strips them entirely so there is no runtime code for Stryker to mutate.",
	},

	// ── tooling/stryker/stryker.config.mjs — pre-existing intentional
	//    exclusions documented inline in that file. Each is either a pure
	//    re-export barrel (zero mutants → would mark UNSCORED) or a
	//    pure-data manifest whose values are tested by their non-`-data`
	//    siblings. Code-fix to bring in scope is not possible without
	//    coverting them to runtime modules they semantically aren't.
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/**/index.ts",
		rubric:
			"Pure re-export barrel files. Stryker produces zero mutants and the gate would mark them UNSCORED. Equivalent to a type-only declaration in mutability terms.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/persistence-types.ts",
		rubric:
			"Pure TypeScript interface/type declarations (repository, store, event shapes). No runtime statements; stripped at transpile time.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/config-service-types.ts",
		rubric:
			"Pure TypeScript interface declarations for config shapes (Analytics, GiveLively, Testimonials, Donations, AbTesting, AstropressApi). No runtime code.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/admin-stub-catalog.ts",
		rubric:
			"Pure-data manifest. Top-level entries are static mutants; values are admin label strings with no behavioural contract — behavioural accessors live in non-`-data` siblings tested at ≥95%.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/admin-ui-translation-keys.ts",
		rubric:
			"Pure-data manifest. UI translation key catalogue; values carry no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/api-routes-data.ts",
		rubric:
			"Pure-data manifest. API route metadata catalogue; behavioural routing logic tested via routing handlers at ≥95%.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/app-host-targets-data.ts",
		rubric:
			"Pure-data manifest. App host target catalogue; values are deployment metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/access/action-registry-data.ts",
		rubric:
			"Pure-data manifest. Action registry metadata; behavioural authorization checks live in non-`-data` siblings.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/data-service-targets-data.ts",
		rubric:
			"Pure-data manifest. Data service target catalogue; values are provider metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/deployment-matrix-data.ts",
		rubric:
			"Pure-data manifest. Deployment matrix; values are scenario metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/integration-manifest-data.ts",
		rubric:
			"Pure-data manifest. Integration manifest; values are provider metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/project-scaffold-passphrase-wordlist.ts",
		rubric:
			"Pure-data manifest. Passphrase wordlist (English words); mutating values tests dictionary correctness, not behaviour.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/provider-targets-data.ts",
		rubric:
			"Pure-data manifest. Provider target catalogue; values are deployment-time metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/site-settings.ts",
		rubric:
			"Pure-data manifest. Site-wide marketing/labelling constants; values carry no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/admin-app-integration-data.ts",
		rubric:
			"Pure-data manifest. Admin app integration catalogue; values are metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/admin-page-models-access-data.ts",
		rubric:
			"Pure-data manifest. Admin page access matrix; values are metadata, behavioural access checks live in non-`-data` siblings.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/integrations/registry-data.ts",
		rubric:
			"Pure-data manifest. Integration registry; values are provider metadata with no behavioural contract.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/sqlite-admin-runtime-options.ts",
		rubric: "Pure-data manifest. Admin runtime option defaults; values are configuration metadata.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/sqlite-admin-runtime-wiring.ts",
		rubric:
			"Pure-data manifest. Admin runtime wiring table; mutation-equivalent of a const config dictionary.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/sqlite-bootstrap-seed-sql.ts",
		rubric:
			"Pure-data manifest. SQL seed strings; values are tested via the bootstrap behavioural tests that consume them.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/import/wordpress-xml-tags-data.ts",
		rubric:
			"Pure-data manifest. WordPress XML tag name constants; values are tested via the parser that consumes them.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/integration.ts",
		rubric:
			"Pure re-export barrel / type-only. Honors the in-file `stryker-disable-file: data-only` marker that the runner doesn't enforce.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/integrations/domains.ts",
		rubric:
			"Pure re-export barrel / type-only. Honors the in-file `stryker-disable-file: data-only` marker.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/platform-contracts-helpers.ts",
		rubric:
			"Pure re-export barrel / type-only. Honors the in-file `stryker-disable-file: data-only` marker.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/runtime-admin-actions.ts",
		rubric:
			"Pure re-export barrel / type-only. Honors the in-file `stryker-disable-file: data-only` marker.",
	},
	{
		config: "tooling/stryker/stryker.config.mjs",
		pattern: "!src/runtime-route-registry.ts",
		rubric:
			"Pure re-export barrel / type-only. Honors the in-file `stryker-disable-file: data-only` marker.",
	},
];

const MUTATE_BLOCK_RE = /mutate\s*:\s*\[([\s\S]*?)\]/;
const NEGATION_RE = /"(![^"]+)"/g;

function findConfigs(): string[] {
	const tracked = execSync("git ls-files", { encoding: "utf8" }).trim().split("\n");
	return tracked.filter(
		(f) =>
			(f.endsWith(".mjs") || f.endsWith(".config.mjs")) &&
			/(?:^|\/)stryker[^/]*\.mjs$/.test(f) &&
			!f.includes("node_modules") &&
			!f.includes(".stryker-tmp"),
	);
}

function extractNegations(source: string): { pattern: string; line: number }[] {
	const blockMatch = MUTATE_BLOCK_RE.exec(source);
	if (!blockMatch) return [];
	const blockStart = (blockMatch.index ?? 0) + blockMatch[0].indexOf("[");
	const block = blockMatch[1];
	return Array.from(block.matchAll(NEGATION_RE)).map((m) => {
		const absIdx = blockStart + 1 + (m.index ?? 0);
		const line = source.slice(0, absIdx).split("\n").length;
		return { pattern: m[1] as string, line };
	});
}

function isApproved(config: string, pattern: string): boolean {
	return ALLOWLIST.some((a) => a.config === config && a.pattern === pattern);
}

function main(): number {
	const configs = findConfigs();
	const violations: string[] = [];

	for (const config of configs) {
		let src: string;
		try {
			src = readFileSync(config, "utf8");
		} catch {
			continue;
		}
		for (const { pattern, line } of extractNegations(src)) {
			if (!isApproved(config, pattern)) {
				violations.push(
					`${config}:${line}\n  Pattern: ${pattern}\n  Reason:  Stryker mutate-list exclusion silently removes mutation coverage. Either bring the file in scope (preferred) or register it in ALLOWLIST in tooling/scripts/audit-stryker-exclusions.ts with a rubric explaining why scoring is impossible (zero runtime surface AND no clean code-fix).`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error(`stryker-exclusions audit FAILED — ${violations.length} issue(s):\n`);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nEvery `!`-prefixed entry in a stryker config's mutate array must be evaluated\n" +
				"against the rubric and registered in ALLOWLIST in tooling/scripts/audit-stryker-exclusions.ts.\n" +
				"The rubric requires: (1) zero runtime surface (no mutants Stryker can score); and\n" +
				"(2) no code-fix alternative (e.g. moving data to a *-data.ts sibling with\n" +
				"`stryker-disable-file: data-only`).",
		);
		return 1;
	}

	console.log(
		`stryker-exclusions audit passed — ${configs.length} config(s) scanned, all exclusions registered.`,
	);
	return 0;
}

process.exit(main());
