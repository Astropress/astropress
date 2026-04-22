import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

// New audit: No Stub Tests
//
// Scans all test files for patterns that indicate incomplete or placeholder tests:
//   - it.todo / test.todo — acknowledged but unimplemented
//   - it.skip / test.skip / describe.skip — tests disabled without explanation
//   - expect(true).toBe(true) / expect(false).toBe(false) — vacuous assertions
//   - expect(CONSTANT).toBe(CONSTANT) — assertion that can never fail
//   - Empty test bodies: it("...", () => {})
//   - Stub/TODO comments inside test files
//
// Directories scanned:
//   - packages/astropress/tests/
//   - packages/astropress-nexus/tests/
//   - packages/astropress-mcp/ (if it exists)

const root = process.cwd();

const TEST_DIRS = [
	join(root, "packages/astropress/tests"),
	join(root, "packages/astropress-nexus/tests"),
];

// Optional dirs — won't fail if they don't exist
const OPTIONAL_TEST_DIRS = [join(root, "packages/astropress-mcp")];

interface StubPattern {
	name: string;
	// Either a string to include-check or a regex to test
	pattern: string | RegExp;
}

const STUB_PATTERNS: StubPattern[] = [
	{ name: "todo test", pattern: /\bit\.todo\s*\(|\btest\.todo\s*\(/ },
	// Flags it.skip("name", () => ...) — test with an implemented body that was silently disabled.
	// Does NOT flag it.skip("reason") with no callback — that is a valid "pending with reason" marker.
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
	// Note: "stub" is intentionally excluded — vi.stubGlobal / vi.stubEnv are valid test setup
	// patterns that appear in comments like "// Stub fetch to return 404". The unambiguous
	// incomplete-test markers are TODO, FIXME, and placeholder.
	{
		name: "stub comment in test",
		pattern: /\/\/\s*(TODO|FIXME|placeholder)\b/i,
	},
];

async function directoryExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function collectTestFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true });
	return entries.filter((f) => f.endsWith(".test.ts")).map((f) => join(dir, f));
}

async function main() {
	const violations: string[] = [];

	const allDirs = [
		...TEST_DIRS,
		...(
			await Promise.all(
				OPTIONAL_TEST_DIRS.map(async (d) =>
					(await directoryExists(d)) ? d : null,
				),
			)
		).filter((d): d is string => d !== null),
	];

	let totalFiles = 0;

	for (const dir of allDirs) {
		let testFiles: string[];
		try {
			testFiles = await collectTestFiles(dir);
		} catch {
			continue;
		}

		for (const filePath of testFiles) {
			totalFiles++;
			const src = await readFile(filePath, "utf8");
			const relPath = relative(root, filePath);
			const lines = src.split("\n");

			for (const { name, pattern } of STUB_PATTERNS) {
				if (typeof pattern === "string") {
					if (src.includes(pattern)) {
						violations.push(`${relPath}: ${name} — \`${pattern}\``);
					}
				} else {
					// Find the specific line(s) for better error messages
					for (let i = 0; i < lines.length; i++) {
						if (pattern.test(lines[i])) {
							violations.push(
								`${relPath}:${i + 1}: ${name} — \`${lines[i].trim()}\``,
							);
							// Reset lastIndex for global regexes
							if (pattern.global) pattern.lastIndex = 0;
							break; // Report first occurrence per file per pattern
						}
					}
				}
			}
		}
	}

	if (violations.length > 0) {
		console.error(
			`no-stub-tests audit failed — ${violations.length} stub pattern(s) found in ${totalFiles} test files:\n`,
		);
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		console.error(
			"\nTo fix: remove placeholder tests, replace it.skip with proper implementation or a clear explanation comment, and replace vacuous assertions with meaningful ones.",
		);
		process.exit(1);
	}

	console.log(
		`no-stub-tests audit passed — ${totalFiles} test files scanned, no stub patterns found.`,
	);
}

main().catch((err) => {
	console.error("no-stub-tests audit failed:", err);
	process.exit(1);
});
