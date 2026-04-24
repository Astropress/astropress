import { join } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Verifies that:
//   1. Every `from "./src/adapters/foo"` path referenced in packages/astropress/index.ts
//      has a corresponding .ts file on disk.
//   2. Each exported adapter function name (from non-type export lines) appears
//      in at least one test file under packages/astropress/tests/.
//
// Prevents index.ts from re-exporting symbols from deleted or never-created adapter files.

const INDEX_TS = fromRoot("packages/astropress/index.ts");
const TESTS_DIR = fromRoot("packages/astropress/tests");

interface AdapterExport {
	adapterPath: string;
	resolvedTs: string;
	functionNames: string[];
}

function parseAdapterExports(indexSrc: string): AdapterExport[] {
	const results: AdapterExport[] = [];

	const exportRegex =
		/^export\s+\{([^}]+)\}\s+from\s+"(\.\/src\/adapters\/[^"]+)"/gm;

	for (const m of indexSrc.matchAll(exportRegex)) {
		const exportBlock = m[0];
		const symbolList = m[1];
		const fromPath = m[2];

		if (/^export\s+type\s+\{/.test(exportBlock)) continue;

		const cleanPath = fromPath.replace(/\.js$/, "");
		const resolvedTs = fromRoot("packages/astropress", `${cleanPath}.ts`);

		const names = symbolList
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s && !s.startsWith("type "))
			.filter((s) => /^[a-z]/.test(s));

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
	const entries = await listFiles(dir);
	return entries.filter((f) => f.endsWith(".test.ts")).map((f) => join(dir, f));
}

async function main() {
	const report = new AuditReport("exports");
	const indexSrc = await readText(INDEX_TS);
	const adapterExports = parseAdapterExports(indexSrc);
	const testFiles = await collectTestFiles(TESTS_DIR);

	const testContents = await Promise.all(
		testFiles.map(async (f) => ({ file: f, src: await readText(f) })),
	);

	for (const { adapterPath, resolvedTs, functionNames } of adapterExports) {
		if (!(await fileExists(resolvedTs))) {
			report.add(
				`${adapterPath} — referenced in index.ts but ${resolvedTs} does not exist`,
			);
			continue;
		}

		for (const name of functionNames) {
			const testedIn = testContents.find(({ src }) => src.includes(name));
			if (!testedIn) {
				report.add(
					`${name} (from ${adapterPath}) — exported in index.ts but not found in any test file`,
				);
			}
		}
	}

	const totalFns = adapterExports.reduce(
		(n, a) => n + a.functionNames.length,
		0,
	);
	report.finish(
		`exports audit passed — ${adapterExports.length} adapter files exist, ${totalFns} exported functions covered by tests.`,
	);
}

runAudit("exports", main);
