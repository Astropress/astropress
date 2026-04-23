import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

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

const SRC_DIR = fromRoot("packages/astropress/src");
const TESTS_DIR = fromRoot("packages/astropress/tests");
const WC_DIR = fromRoot("packages/astropress/web-components");
const PAGES_DIR = fromRoot("packages/astropress/pages");
const COMPONENTS_DIR = fromRoot("packages/astropress/components");
const INDEX_TS = fromRoot("packages/astropress/index.ts");

const ALLOWLISTED_NAMES = new Set<string>([
	// crypto-primitives.ts — low-level helpers used only within the crypto layer
	"bytesToBase64",
	"bytesToHex",
	"constantTimeEqual",
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
	const entries = await listFiles(dir, { recursive: true });
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
		collectSourceFiles(COMPONENTS_DIR, ".astro"),
	]);
	return [...srcFiles, ...wcFiles, ...pagesFiles, ...componentFiles];
}

function extractExportedNames(src: string): string[] {
	const names: string[] = [];

	for (const m of src.matchAll(
		/^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|const\s+)(\w+)/gm,
	)) {
		names.push(m[1]);
	}

	for (const m of src.matchAll(
		/^export\s+\{([^}]+)\}(?:\s+from\s+["'][^"']+["'])?/gm,
	)) {
		const line = m[0];
		if (line.includes(" from ")) continue;
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
	const report = new AuditReport("dead-exports");

	const indexSrc = await readText(INDEX_TS);
	const testEntries = await listFiles(TESTS_DIR);
	const testFiles = await Promise.all(
		testEntries
			.filter((f) => f.endsWith(".test.ts"))
			.map((f) => readText(join(TESTS_DIR, f))),
	);
	const allOtherFiles = await collectAllFiles();

	const consumerContents = await Promise.all(
		allOtherFiles.map((f) => readText(f)),
	);

	const corpus = [indexSrc, ...testFiles, ...consumerContents].join("\n");

	const srcFiles = await collectSourceFiles(SRC_DIR);

	for (const filePath of srcFiles) {
		const src = await readText(filePath);
		const relPath = relative(ROOT, filePath);
		const exportedNames = extractExportedNames(src);

		for (const name of exportedNames) {
			if (ALLOWLISTED_NAMES.has(name)) continue;

			if (!corpus.includes(name)) {
				report.add(
					`${relPath}: \`${name}\` is exported but has no consumers — consider removing or moving to an internal module`,
				);
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nTo fix: either remove the export, add it to packages/astropress/index.ts, or add it to the ALLOWLISTED_NAMES in tooling/scripts/audit-dead-exports.ts with a justification comment.",
		);
	}

	report.finish(
		"dead-exports audit passed — all runtime exports in packages/astropress/src/ have at least one consumer.",
	);
}

runAudit("dead-exports", main);
