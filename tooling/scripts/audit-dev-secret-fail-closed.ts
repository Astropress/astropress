/**
 * audit-dev-secret-fail-closed.ts
 *
 * Enforces a single source of the development root-secret fallback string.
 *
 * Why: the literal `"astropress-dev-root-secret"` used to appear in three
 * places in source (runtime-env.ts twice + sqlite-runtime/utils.ts as the
 * hashOpaqueToken default), so production deployments missing
 * ASTROPRESS_ROOT_SECRET silently hashed sessions, invite/reset tokens, API
 * tokens, and sealed integration secrets with a publicly-known constant
 * (issues #126 / #132). Centralising the literal — and forbidding any
 * second source — means a future regression must reintroduce the literal in
 * exactly one audited spot, where the fail-closed-in-production resolver
 * (`devRootSecretOrThrow`) lives.
 *
 * Rule: the literal `"astropress-dev-root-secret"` may appear ONLY in
 * `packages/astropress/src/runtime-env.ts`, and there MUST be exactly one
 * occurrence (the `DEV_ROOT_SECRET_FALLBACK` const).
 *
 * Test files are scanned too because production-sensitive helpers had their
 * fallback behaviour pinned by tests asserting the literal — those tests
 * now import the const symbol instead.
 *
 * Exit 0 — invariant holds.
 * Exit 1 — literal found outside the resolver, or count != 1 inside it.
 */

import { extname, join, relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const LITERAL = '"astropress-dev-root-secret"';
const ALT_LITERAL = "'astropress-dev-root-secret'";
const RESOLVER_FILE = "packages/astropress/src/runtime-prod.ts";

const SCAN_ROOTS = [
	"packages/astropress/src",
	"packages/astropress/tests",
	"packages/astropress/pages",
	"packages/astropress/components",
];

async function main(): Promise<void> {
	const report = new AuditReport("dev-secret-fail-closed");

	let resolverOccurrences = 0;
	let resolverPresent = false;

	for (const root of SCAN_ROOTS) {
		const abs = fromRoot(root);
		const files = await listFiles(abs, { recursive: true });
		for (const entry of files) {
			const ext = extname(entry);
			if (ext !== ".ts" && ext !== ".tsx" && ext !== ".astro") continue;
			const full = join(abs, entry);
			const rel = relative(fromRoot(), full);
			const src = await readText(full);
			const count =
				occurrences(src, LITERAL) +
				occurrences(src, ALT_LITERAL) +
				occurrences(src, "`astropress-dev-root-secret`");

			if (rel === RESOLVER_FILE) {
				resolverPresent = true;
				resolverOccurrences = count;
				continue;
			}

			if (count > 0) {
				report.add(
					`${rel}: the literal "astropress-dev-root-secret" appears ${count}× outside ` +
						`the single sanctioned resolver (${RESOLVER_FILE}). ` +
						`Import DEV_ROOT_SECRET_FALLBACK / call devRootSecretOrThrow() / resolveTokenHashSecret() instead.`,
				);
			}
		}
	}

	if (!resolverPresent) {
		report.add(
			`${RESOLVER_FILE}: expected resolver file is missing — cannot validate the single-source invariant.`,
		);
	} else if (resolverOccurrences !== 1) {
		report.add(
			`${RESOLVER_FILE}: literal "astropress-dev-root-secret" should appear exactly once ` +
				`(as DEV_ROOT_SECRET_FALLBACK); found ${resolverOccurrences} occurrence(s).`,
		);
	}

	report.finish(
		`✓ audit:dev-secret-fail-closed — single literal in ${RESOLVER_FILE}; no other source files reference it`,
	);
}

function occurrences(haystack: string, needle: string): number {
	if (!needle) return 0;
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = haystack.indexOf(needle, index + needle.length);
	}
	return count;
}

runAudit("dev-secret-fail-closed", main);
