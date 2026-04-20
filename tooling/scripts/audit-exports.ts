import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Verifies that:
//   1. Every `from "./src/adapters/foo"` path referenced in packages/astropress/index.ts
//      has a corresponding .ts file on disk.
//   2. Each exported adapter function name (from non-type export lines) appears
//      in at least one test file under packages/astropress/tests/.
//
// Prevents index.ts from re-exporting symbols from deleted or never-created adapter files.

const root = process.cwd();
const INDEX_TS = join(root, "packages/astropress/index.ts");
const TESTS_DIR = join(root, "packages/astropress/tests");

interface AdapterExport {
	adapterPath: string; // e.g. ./src/adapters/cloudflare
	resolvedTs: string; // e.g. /abs/path/packages/astropress/src/adapters/cloudflare.ts
	functionNames: string[];
}

async function parseAdapterExports(indexSrc: string): Promise<AdapterExport[]> {
	const results: AdapterExport[] = [];

	// Match: export { foo, bar } from "./src/adapters/baz"
	// or:    export { foo, bar } from "./src/adapters/baz.js"
	// Skip:  export type { ... } from "..."
	const exportRegex =
		/^export\s+\{([^}]+)\}\s+from\s+"(\.\/src\/adapters\/[^"]+)"/gm;

	for (const m of indexSrc.matchAll(exportRegex)) {
		const exportBlock = m[0];
		const symbolList = m[1];
		const fromPath = m[2];

		// Skip type-only exports — they have no runtime call sites to test.
		if (/^export\s+type\s+\{/.test(exportBlock)) continue;

		// Resolve the .ts file path (strip .js extension if present).
		const cleanPath = fromPath.replace(/\.js$/, "");
		const resolvedTs = join(root, "packages/astropress", `${cleanPath}.ts`);

		// Extract individual exported names, filtering out type-prefixed ones.
		const names = symbolList
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s && !s.startsWith("type "))
			.filter((s) => /^[a-z]/.test(s)); // adapter functions start with lowercase

		if (names.length === 0) continue;

		const existing = results.find((r) => r.adapterPath === fromPath);
		if (existing) {
			existing.functionNames.push(...names);
		} else {
			results.push({ adapterPath: fromPath, resolvedTs, functionNames: names });
		}
	}

	return results;
}

async function collectTestFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir);
	return entries.filter((f) => f.endsWith(".test.ts")).map((f) => join(dir, f));
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const indexSrc = await readFile(INDEX_TS, "utf8");
	const adapterExports = await parseAdapterExports(indexSrc);
	const testFiles = await collectTestFiles(TESTS_DIR);

	// Read all test files once for efficient substring search.
	const testContents = await Promise.all(
		testFiles.map(async (f) => ({ file: f, src: await readFile(f, "utf8") })),
	);

	const missingFiles: string[] = [];
	const untestedFunctions: string[] = [];

	for (const { adapterPath, resolvedTs, functionNames } of adapterExports) {
		// 1. Assert the .ts file exists.
		if (!(await fileExists(resolvedTs))) {
			missingFiles.push(
				`${adapterPath} — referenced in index.ts but ${resolvedTs} does not exist`,
			);
			continue; // no point checking functions if the file is missing
		}

		// 2. Assert each exported function appears in at least one test file.
		for (const name of functionNames) {
			const testedIn = testContents.find(({ src }) => src.includes(name));
			if (!testedIn) {
				untestedFunctions.push(
					`${name} (from ${adapterPath}) — exported in index.ts but not found in any test file`,
				);
			}
		}
	}

	const violations = [...missingFiles, ...untestedFunctions];

	if (violations.length > 0) {
		console.error("exports audit failed:\n");
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	const totalFns = adapterExports.reduce(
		(n, a) => n + a.functionNames.length,
		0,
	);
	console.log(
		`exports audit passed — ${adapterExports.length} adapter files exist, ${totalFns} exported functions covered by tests.`,
	);
}

main().catch((err) => {
	console.error("exports audit failed:", err);
	process.exit(1);
});
