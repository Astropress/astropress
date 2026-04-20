import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Verifies that the three cryptographic algorithms claimed in docs
// (Argon2id, KMAC256, ML-DSA-65) are implemented via the correct library
// imports at their actual call sites, not just referenced in comments or prose.
//
// For each algorithm, finds every .ts file in packages/astropress/src/ that
// invokes the algorithm function/object, then asserts the expected library
// import is present in that same file. Fails if any call site lacks the import.

const root = process.cwd();
const SRC_DIR = join(root, "packages/astropress/src");

interface CryptoAlgorithm {
	/** Human-readable name (used in error messages). */
	name: string;
	/** The identifier used at call sites (function or object name). */
	callSiteToken: string;
	/** The import source the call site must import from. */
	expectedImportSource: string;
	/** The imported name from that source. */
	expectedImportName: string;
}

const ALGORITHMS: CryptoAlgorithm[] = [
	{
		name: "Argon2id",
		callSiteToken: "argon2id",
		expectedImportSource: "@noble/hashes/argon2",
		expectedImportName: "argon2id",
	},
	{
		name: "KMAC256",
		callSiteToken: "kmac256",
		expectedImportSource: "@noble/hashes/sha3-addons",
		expectedImportName: "kmac256",
	},
	{
		name: "ML-DSA-65",
		callSiteToken: "ml_dsa65",
		expectedImportSource: "@noble/post-quantum/ml-dsa",
		expectedImportName: "ml_dsa65",
	},
];

async function collectSourceFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true });
	return entries
		.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
		.map((f) => join(dir, f));
}

function hasCallSite(src: string, token: string): boolean {
	// Match the token followed by ( or . to distinguish call sites from
	// string literals, comments that merely mention the algorithm name.
	// Example: argon2id( or ml_dsa65.keygen
	const callSiteRe = new RegExp(`\\b${token}\\s*[.(]`);
	return callSiteRe.test(src);
}

function hasImport(
	src: string,
	importSource: string,
	importName: string,
): boolean {
	// Match: import { ... importName ... } from "importSource"
	// or:    import { ... importName ... } from 'importSource'
	// The source may include a .js suffix variant.
	const escapedSource = importSource.replace(/[/.-]/g, (c) =>
		c === "/" ? "\\/" : c === "." ? "\\." : "\\-",
	);
	const re = new RegExp(
		`import\\s*\\{[^}]*\\b${importName}\\b[^}]*\\}\\s*from\\s*["']${escapedSource}(?:\\.js)?["']`,
	);
	return re.test(src);
}

async function main() {
	const sourceFiles = await collectSourceFiles(SRC_DIR);
	const violations: string[] = [];

	for (const algo of ALGORITHMS) {
		for (const filePath of sourceFiles) {
			const src = await readFile(filePath, "utf8");

			if (!hasCallSite(src, algo.callSiteToken)) continue;

			if (!hasImport(src, algo.expectedImportSource, algo.expectedImportName)) {
				const rel = filePath.replace(`${root}/`, "");
				violations.push(
					`${algo.name}: ${rel} calls \`${algo.callSiteToken}\` but does not import \`${algo.expectedImportName}\` from "${algo.expectedImportSource}"`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error("crypto audit failed:\n");
		for (const v of violations) {
			console.error(`  - ${v}`);
		}
		process.exit(1);
	}

	const algoNames = ALGORITHMS.map((a) => a.name).join(", ");
	console.log(
		`crypto audit passed — ${ALGORITHMS.length} algorithms verified (${algoNames}), all call sites import from the correct libraries.`,
	);
}

main().catch((err) => {
	console.error("crypto audit failed:", err);
	process.exit(1);
});
