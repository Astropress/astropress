import { join } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Verifies that every env var key listed in the deployment matrix
// (packages/astropress/src/deployment-matrix.ts) is actually read somewhere
// in packages/astropress/src/. Prevents "SUPABASE_ANON_KEY"-style drift where
// a key is documented as required but never consumed by the runtime code.

const DEPLOYMENT_MATRIX = fromRoot(
	"packages/astropress/src/deployment-matrix.ts",
);
const SRC_DIR = fromRoot("packages/astropress/src");

function extractRequiredEnvKeys(matrixSrc: string): string[] {
	const keys = new Set<string>();
	for (const m of matrixSrc.matchAll(/"([A-Z][A-Z0-9_]+)"/g)) {
		if (/^[A-Z][A-Z0-9_]{2,}$/.test(m[1])) {
			keys.add(m[1]);
		}
	}
	return [...keys].sort();
}

async function collectSourceFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, { recursive: true });
	return entries
		.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
		.map((f) => join(dir, f));
}

async function fileReadsKey(filePath: string, key: string): Promise<boolean> {
	const src = await readText(filePath);
	return (
		src.includes(`env.${key}`) ||
		src.includes(`env["${key}"]`) ||
		src.includes(`env['${key}']`) ||
		src.includes(`env?.${key}`) ||
		src.includes(`process.env.${key}`) ||
		src.includes(`process.env?.${key}`) ||
		src.includes(`process.env["${key}"]`) ||
		new RegExp(`["']${key}["']`).test(src)
	);
}

async function main() {
	const report = new AuditReport("env-contract");
	const matrixSrc = await readText(DEPLOYMENT_MATRIX);
	const requiredKeys = extractRequiredEnvKeys(matrixSrc);

	const allSourceFiles = await collectSourceFiles(SRC_DIR);
	const sourceFiles = allSourceFiles.filter(
		(f) => !f.endsWith("deployment-matrix.ts"),
	);

	for (const key of requiredKeys) {
		let found = false;
		for (const file of sourceFiles) {
			if (await fileReadsKey(file, key)) {
				found = true;
				break;
			}
		}
		if (!found) {
			report.add(
				`${key} — listed in deployment-matrix requiredEnvKeys but never read in packages/astropress/src/`,
			);
		}
	}

	report.finish(
		`env-contract audit passed — ${requiredKeys.length} required env keys, all read in src/.`,
	);
}

runAudit("env-contract", main);
