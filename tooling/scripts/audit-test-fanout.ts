// Static audit that flags test files which read or import too many distinct
// source-path string literals. High fan-out test suites are a stryker
// incremental-cache hazard: editing the test file invalidates mutant verdicts
// across every src file the suite covers, so a 1-line change to a 20-fan-out
// suite re-runs mutation testing on 20 src files instead of 1.
//
// The metric is "distinct file-path string literals referenced from the test"
// (an OR of `path.join("…")`, `path.resolve("…")`, and bare ".astro"/".ts"/".css"
// string literals). It correlates with the set of source files vitest will
// actually load when the test executes, which is what stryker's incremental
// algorithm hashes for invalidation purposes.
//
// Threshold: 8 distinct paths. Tests above the threshold must either:
//   (a) be split into smaller files focused on a single concern, or
//   (b) be added to ALLOWLIST below with a one-line rationale.
//
// Why 8: empirical — most well-scoped suites in this repo touch ≤5 files;
// the 6–7 band is "tightly-related cluster", and ≥8 starts being where edits
// cause cache fan-out we'd notice on a long-running branch.

import type { Dirent } from "node:fs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AuditReport, fromRoot, runAudit } from "../lib/audit-utils.js";

const TEST_ROOTS = ["packages/astropress/tests", "packages/astropress/bdd/tests"];

const MAX_FANOUT = 8;

// Tests that legitimately exercise many source files because they are
// integration-tier, contract-tier, or static-analysis-over-the-tree.
// Each entry MUST have a one-line rationale explaining why splitting would
// not improve cache locality.
const ALLOWLIST: ReadonlyMap<string, string> = new Map([
	[
		"tooling-integration.test.ts",
		"integration test that intentionally walks the full tooling/ tree",
	],
	["vite-runtime-alias.test.ts", "aliasing contract — must verify every entrypoint resolves"],
	["api-routes.test.ts", "route-table contract — surface area is the test, by design"],
	["api-endpoints.test.ts", "endpoint-shape contract — surface area is the test, by design"],
	[
		"zta-invariants.test.ts",
		"Zero Trust invariants — cross-cutting auth/CSRF/audit checks across the tree",
	],
	[
		"global-privacy-baseline.test.ts",
		"GDPR/privacy invariants — cross-cutting data-minimisation/retention checks",
	],
	[
		"db-migrate-ops.test.ts",
		"migration runner contract — exercises the full apply/rollback API surface",
	],
	["sync-git.test.ts", "git-sync adapter contract — exercises export/import/sqlite paths together"],
	[
		"audit-registry.test.ts",
		"audit/playwright registry contract — must verify all four call sites stay in lockstep",
	],
	[
		"deploy-and-sync.contract.test.ts",
		"deploy + sync contract — runs all deploy targets through one adapter API",
	],
	[
		"cloudflare-vite-integration.test.ts",
		"resolveId contract — must verify every (module-name × extension) variant resolves",
	],
]);

interface FanoutResult {
	relPath: string;
	count: number;
	paths: string[];
}

function walkTests(dir: string, out: string[]): void {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkTests(full, out);
		} else if (entry.name.endsWith(".test.ts")) {
			out.push(full);
		}
	}
}

// Match string literals that look like file paths into the source tree.
// Hits: "components/AdminLayout.astro", "../src/admin-ui.ts", "public/admin.css".
// Skips: bare identifiers, http(s) URLs (no double-slash anchor), regex bodies.
const PATH_LITERAL = /["`]([^"`\n]+\.(?:astro|ts|tsx|css|sql|mjs|cjs|js|json))["`]/g;

function extractFanout(src: string): string[] {
	const paths = new Set<string>();
	for (const match of src.matchAll(PATH_LITERAL)) {
		const literal = match[1];
		// Path-like: contains a slash, or has a recognised extension and looks
		// like a file rather than a content sample.
		if (literal.startsWith("http")) continue;
		if (literal.startsWith("data:")) continue;
		if (!literal.includes("/") && !literal.includes(".")) continue;
		paths.add(literal);
	}
	return [...paths].sort();
}

async function main(): Promise<void> {
	const tests: string[] = [];
	for (const root of TEST_ROOTS) walkTests(fromRoot(root), tests);

	const results: FanoutResult[] = [];
	for (const path of tests) {
		const src = readFileSync(path, "utf8");
		const paths = extractFanout(src);
		const rel = path.replace(`${fromRoot()}/`, "");
		const basename = rel.split("/").pop() ?? rel;
		results.push({ relPath: rel, count: paths.length, paths });
		void basename;
	}

	const report = new AuditReport("test-fanout");
	for (const r of results) {
		const basename = r.relPath.split("/").pop() ?? r.relPath;
		if (r.count <= MAX_FANOUT) continue;
		if (ALLOWLIST.has(basename)) continue;
		report.add(
			`${r.relPath} reads ${r.count} distinct source paths (max ${MAX_FANOUT}). ` +
				`Split by concern or add to ALLOWLIST in tooling/scripts/audit-test-fanout.ts.`,
		);
	}

	// Surface stale allowlist entries — once a test is split it should drop
	// out of the allowlist, not stay there forever.
	for (const [basename, reason] of ALLOWLIST) {
		const match = results.find((r) => r.relPath.endsWith(`/${basename}`));
		if (!match) {
			report.add(
				`ALLOWLIST entry '${basename}' (${reason}) does not match any test file — remove it.`,
			);
			continue;
		}
		if (match.count <= MAX_FANOUT) {
			report.add(
				`'${basename}' is in ALLOWLIST but only reads ${match.count} paths (≤${MAX_FANOUT}); remove the allowlist entry.`,
			);
		}
	}

	report.finish(
		`test-fanout audit passed (${results.length} test files scanned, ${MAX_FANOUT} max distinct paths).`,
	);
}

runAudit("test-fanout", main);
