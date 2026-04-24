import { join, relative } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

// New audit: No Stub Tests
//
// Scans all test files for patterns that indicate incomplete or placeholder tests:
//   - it.todo / test.todo — acknowledged but unimplemented
//   - it.skip / test.skip / describe.skip — tests disabled without explanation
//   - expect(true).toBe(true) / expect(false).toBe(false) — vacuous assertions
//   - expect(CONSTANT).toBe(CONSTANT) — assertion that can never fail
//   - Empty test bodies: it("...", () => {})
//   - Stub/TODO comments inside test files

const TEST_DIRS = [
	fromRoot("packages/astropress/tests"),
	fromRoot("packages/astropress-nexus/tests"),
];

const OPTIONAL_TEST_DIRS = [fromRoot("packages/astropress-mcp")];

interface StubPattern {
	name: string;
	pattern: string | RegExp;
}

const STUB_PATTERNS: StubPattern[] = [
	{ name: "todo test", pattern: /\bit\.todo\s*\(|\btest\.todo\s*\(/ },
	{
		name: "skipped test with body",
		pattern:
			/\bit\.skip\s*\(\s*["'][^"']*["']\s*,|\btest\.skip\s*\(\s*["'][^"']*["']\s*,|\bdescribe\.skip\s*\(\s*["'][^"']*["']\s*,/,
	},
	{
		name: "vacuous assertion (expect(true))",
		pattern: /expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/,
	},
	{
		name: "vacuous assertion (expect(false))",
		pattern: /expect\s*\(\s*false\s*\)\s*\.toBe\s*\(\s*false\s*\)/,
	},
	{
		name: "constant equality assertion",
		pattern: /expect\s*\(\s*\d+\s*\)\s*\.toBe\s*\(\s*\d+\s*\)/,
	},
	{
		name: "empty test body",
		pattern: /\bit\s*\(\s*["'][^"']+["']\s*,\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/,
	},
	{
		name: "stub comment in test",
		pattern: /\/\/\s*(TODO|FIXME|placeholder)\b/i,
	},
];

async function collectTestFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, { recursive: true });
	return entries.filter((f) => f.endsWith(".test.ts")).map((f) => join(dir, f));
}

async function main() {
	const report = new AuditReport("no-stub-tests");

	const optionalResolved = await Promise.all(
		OPTIONAL_TEST_DIRS.map(async (d) => ((await fileExists(d)) ? d : null)),
	);
	const allDirs = [
		...TEST_DIRS,
		...optionalResolved.filter((d): d is string => d !== null),
	];

	let totalFiles = 0;

	for (const dir of allDirs) {
		const testFiles = await collectTestFiles(dir);

		for (const filePath of testFiles) {
			totalFiles++;
			const src = await readText(filePath);
			const relPath = relative(ROOT, filePath);
			const lines = src.split("\n");

			for (const { name, pattern } of STUB_PATTERNS) {
				if (typeof pattern === "string") {
					if (src.includes(pattern)) {
						report.add(`${relPath}: ${name} — \`${pattern}\``);
					}
				} else {
					for (let i = 0; i < lines.length; i++) {
						if (pattern.test(lines[i])) {
							report.add(
								`${relPath}:${i + 1}: ${name} — \`${lines[i].trim()}\``,
							);
							if (pattern.global) pattern.lastIndex = 0;
							break;
						}
					}
				}
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nTo fix: remove placeholder tests, replace it.skip with proper implementation or a clear explanation comment, and replace vacuous assertions with meaningful ones.",
		);
	}

	report.finish(
		`no-stub-tests audit passed — ${totalFiles} test files scanned, no stub patterns found.`,
	);
}

runAudit("no-stub-tests", main);
