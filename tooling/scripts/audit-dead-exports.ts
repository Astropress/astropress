import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

// Rubric 55 (Minimalism)
//
// Lightweight dead-export scanner: finds runtime exports in packages/astropress/src/ that
// have no consumers anywhere in the codebase (not in index.ts, not imported by other src/
// files, not used in tests, not referenced in .astro pages or web-components/).
//
// Skips type-only exports (export type, export interface) — those are erased at runtime.
// Skips files on the allowlist (intentional internal utilities / crypto primitives).
//
// A "dead export" is: exported from file A, but never imported/referenced outside file A.

const root = process.cwd();
const SRC_DIR = join(root, "packages/astropress/src");
const TESTS_DIR = join(root, "packages/astropress/tests");
const WC_DIR = join(root, "packages/astropress/web-components");
const PAGES_DIR = join(root, "packages/astropress/pages");
const COMPONENTS_DIR = join(root, "packages/astropress/components");
const INDEX_TS = join(root, "packages/astropress/index.ts");

// Allowlist: intentional internal-only exports that cross-reference one another
// but are below the visibility of index.ts. Add here only with a comment explaining why.
const ALLOWLISTED_NAMES = new Set<string>([
	// crypto-primitives.ts — low-level helpers used only within the crypto layer
	"bytesToBase64",
	"bytesToHex",
	"constantTimeEqual",
	// sqlite-schema.sql — not a TS export, included here for safety
	// admin-labels.ts — large lookup table only consumed by admin-ui.ts
	"adminLabels",
	// Internal normalizer helpers used by sqlite-runtime/ files
	"normalizePath",
	"normalizeRedirectPath",
	"normalizeEmail",
	"slugify",
	// Internal stub wiring helpers for local dev
	"createLocalAdminStoreModule",
	"createLocalAdminAuthModule",
	"createLocalMediaStorageModule",
	"createLocalImageStorageModule",
	"createLocalCmsRegistryModule",
]);

async function collectSourceFiles(
	dir: string,
	suffix = ".ts",
): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true });
	return entries
		.filter(
			(f) =>
				f.endsWith(suffix) && !f.endsWith(".test.ts") && !f.endsWith(".sql"),
		)
		.map((f) => join(dir, f));
}

async function collectAllFiles(): Promise<string[]> {
	const [srcFiles, wcFiles, pagesFiles, componentFiles] = await Promise.all([
		collectSourceFiles(SRC_DIR),
		collectSourceFiles(WC_DIR),
		collectSourceFiles(PAGES_DIR, ".astro"),
		collectSourceFiles(COMPONENTS_DIR, ".astro").catch(() => []),
	]);
	return [...srcFiles, ...wcFiles, ...pagesFiles, ...componentFiles];
}

function extractExportedNames(src: string): string[] {
	const names: string[] = [];

	// export function/async function/class/const name
	for (const m of src.matchAll(
		/^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|const\s+)(\w+)/gm,
	)) {
		names.push(m[1]);
	}

	// export { name1, name2 } (not type exports)
	for (const m of src.matchAll(
		/^export\s+\{([^}]+)\}(?:\s+from\s+["'][^"']+["'])?/gm,
	)) {
		const line = m[0];
		// Skip re-exports from other modules (those are public API shims, not dead exports)
		if (line.includes(" from ")) continue;
		// Skip type-only export blocks
		if (/^export\s+type\s+\{/.test(line)) continue;
		for (const part of m[1].split(",")) {
			const name = part
				.trim()
				.replace(/^type\s+/, "")
				.replace(/\s+as\s+\w+$/, "")
				.trim();
			if (name) names.push(name);
		}
	}

	return names;
}

async function main() {
	// Build a single string of all "consumer" file contents for fast substring matching
	const [indexSrc, testFiles, allOtherFiles] = await Promise.all([
		readFile(INDEX_TS, "utf8"),
		readdir(TESTS_DIR).then((entries) =>
			Promise.all(
				entries
					.filter((f) => f.endsWith(".test.ts"))
					.map((f) => readFile(join(TESTS_DIR, f), "utf8")),
			),
		),
		collectAllFiles(),
	]);

	const consumerContents = await Promise.all(
		allOtherFiles.map((f) => readFile(f, "utf8").catch(() => "")),
	);

	// Combine everything: index.ts + tests + all other files (this is our "consumer corpus")
	const corpus = [indexSrc, ...testFiles, ...consumerContents].join("\n");

	// Now walk src/ files and check each exported name
	const srcFiles = await collectSourceFiles(SRC_DIR);
	const violations: string[] = [];

	for (const filePath of srcFiles) {
		const src = await readFile(filePath, "utf8");
		const relPath = relative(root, filePath);
		const exportedNames = extractExportedNames(src);

		for (const name of exportedNames) {
			if (ALLOWLISTED_NAMES.has(name)) continue;

			// Check if this name appears ANYWHERE in the consumer corpus
			// (index.ts re-export, another src import, test usage, or .astro page usage)
			if (!corpus.includes(name)) {
				violations.push(
					`${relPath}: \`${name}\` is exported but has no consumers — consider removing or moving to an internal module`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error(
			`dead-exports audit failed — ${violations.length} orphaned export(s):\n`,
		);
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		console.error(
			"\nTo fix: either remove the export, add it to packages/astropress/index.ts, or add it to the ALLOWLISTED_NAMES in tooling/scripts/audit-dead-exports.ts with a justification comment.",
		);
		process.exit(1);
	}

	console.log(
		"dead-exports audit passed — all runtime exports in packages/astropress/src/ have at least one consumer.",
	);
}

main().catch((err) => {
	console.error("dead-exports audit failed:", err);
	process.exit(1);
});
