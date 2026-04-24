import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

// Verifies that the three cryptographic algorithms claimed in docs
// (Argon2id, KMAC256, ML-DSA-65) are implemented via the correct library
// imports at their actual call sites, not just referenced in comments or prose.
//
// For each algorithm, finds every .ts file in packages/astropress/src/ that
// invokes the algorithm function/object, then asserts the expected library
// import is present in that same file. Fails if any call site lacks the import.

const SRC_DIR = fromRoot("packages/astropress/src");

interface CryptoAlgorithm {
	name: string;
	callSiteToken: string;
	expectedImportSource: string;
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
	const entries = await listFiles(dir, { recursive: true });
	return entries
		.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
		.map((f) => join(dir, f));
}

function hasCallSite(src: string, token: string): boolean {
	const callSiteRe = new RegExp(`\\b${token}\\s*[.(]`);
	return callSiteRe.test(src);
}

function hasImport(
	src: string,
	importSource: string,
	importName: string,
): boolean {
	const escapedSource = importSource.replace(/[/.-]/g, (c) =>
		c === "/" ? "\\/" : c === "." ? "\\." : "\\-",
	);
	const re = new RegExp(
		`import\\s*\\{[^}]*\\b${importName}\\b[^}]*\\}\\s*from\\s*["']${escapedSource}(?:\\.js)?["']`,
	);
	return re.test(src);
}

async function main() {
	const report = new AuditReport("crypto");
	const sourceFiles = await collectSourceFiles(SRC_DIR);

	for (const algo of ALGORITHMS) {
		for (const filePath of sourceFiles) {
			const src = await readText(filePath);

			if (!hasCallSite(src, algo.callSiteToken)) continue;

			if (!hasImport(src, algo.expectedImportSource, algo.expectedImportName)) {
				const rel = filePath.replace(`${ROOT}/`, "");
				report.add(
					`${algo.name}: ${rel} calls \`${algo.callSiteToken}\` but does not import \`${algo.expectedImportName}\` from "${algo.expectedImportSource}"`,
				);
			}
		}
	}

	const algoNames = ALGORITHMS.map((a) => a.name).join(", ");
	report.finish(
		`crypto audit passed — ${ALGORITHMS.length} algorithms verified (${algoNames}), all call sites import from the correct libraries.`,
	);
}

runAudit("crypto", main);
