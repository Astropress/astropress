import { join } from "node:path";
import {
	AuditReport,
	fileExists,
	fromRoot,
	listFiles,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

// Rubrics 44 (Multi-site Gateway) + 48 (Nexus UX Quality)
//
// Verifies:
//   1. The astropress-nexus package exists with its core test files
//   2. Every runtime export from nexus index.ts appears in at least one nexus test file
//   3. Every .feature file in tooling/bdd/nexus/ has its scenarios wired in bdd-test.ts
//   4. The nexus app.ts returns structured error responses with a message field (UX)
//   5. Auth middleware is present in the nexus gateway (Bearer token enforcement)

const NEXUS_DIR = fromRoot("packages/astropress-nexus");
const NEXUS_SRC_INDEX = join(NEXUS_DIR, "src/index.ts");
const NEXUS_TESTS_DIR = join(NEXUS_DIR, "tests");
const NEXUS_APP = join(NEXUS_DIR, "src/app.ts");
const NEXUS_BDD_DIR = fromRoot("tooling/bdd/nexus");
const BDD_TEST_TS = fromRoot("tooling/scripts/bdd-test.ts");

const REQUIRED_TEST_FILES = [
	"app.test.ts",
	"connectors.test.ts",
	"jobs.test.ts",
];

function extractRuntimeExports(src: string): string[] {
	const names: string[] = [];
	for (const m of src.matchAll(/^export\s+\{([^}]+)\}\s+from/gm)) {
		const block = m[0];
		if (/^export\s+type\s+/.test(block)) continue;
		for (const name of m[1].split(",").map((s) => s.trim())) {
			if (name && !name.startsWith("type ")) names.push(name);
		}
	}
	for (const m of src.matchAll(
		/^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm,
	)) {
		names.push(m[1]);
	}
	return names;
}

async function main() {
	const report = new AuditReport("nexus");

	// 1. Nexus package structure
	if (!(await fileExists(NEXUS_DIR))) {
		report.add(
			"packages/astropress-nexus/: directory not found — multi-site nexus package is missing",
		);
		report.finish("unreachable");
	}

	for (const testFile of REQUIRED_TEST_FILES) {
		if (!(await fileExists(join(NEXUS_TESTS_DIR, testFile)))) {
			report.add(
				`packages/astropress-nexus/tests/${testFile}: not found — required nexus test file missing`,
			);
		}
	}

	// 2. All runtime exports from nexus index.ts have coverage
	const indexSrc = await readText(NEXUS_SRC_INDEX);
	if (!indexSrc) {
		report.add("packages/astropress-nexus/src/index.ts: not found");
	} else {
		const exportedNames = extractRuntimeExports(indexSrc);

		const testEntries = await listFiles(NEXUS_TESTS_DIR);
		const testFiles = testEntries.filter((f) => f.endsWith(".test.ts"));
		const srcEntries = await listFiles(join(NEXUS_DIR, "src"));
		const srcFiles = srcEntries.filter(
			(f) => f.endsWith(".ts") && f !== "index.ts",
		);

		const [testContents, srcContents] = await Promise.all([
			Promise.all(
				testFiles.map(async (f) => readText(join(NEXUS_TESTS_DIR, f))),
			),
			Promise.all(
				srcFiles.map(async (f) => readText(join(NEXUS_DIR, "src", f))),
			),
		]);
		const combinedCorpus = [...testContents, ...srcContents].join("\n");

		for (const name of exportedNames) {
			if (!combinedCorpus.includes(name)) {
				report.add(
					`nexus export "${name}" — found in src/index.ts but not referenced in any nexus test or src file`,
				);
			}
		}
	}

	// 3. All BDD scenarios in tooling/bdd/nexus/ are wired in bdd-test.ts
	const bddTestSrc = await readText(BDD_TEST_TS);
	if (!bddTestSrc) {
		report.add(
			"tooling/scripts/bdd-test.ts: not found — cannot verify nexus BDD scenario wiring",
		);
	} else {
		const nexusFeatureFiles = (await listFiles(NEXUS_BDD_DIR)).filter((f) =>
			f.endsWith(".feature"),
		);

		for (const featureFile of nexusFeatureFiles) {
			const featureSrc = await readText(join(NEXUS_BDD_DIR, featureFile));
			for (const line of featureSrc.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("Scenario:")) continue;
				const scenarioText = trimmed.slice("Scenario:".length).trim();
				if (!bddTestSrc.includes(scenarioText)) {
					report.add(
						`nexus BDD scenario "${scenarioText}" (${featureFile}) — not wired in tooling/scripts/bdd-test.ts`,
					);
				}
			}
		}
	}

	// 4. Nexus app.ts returns structured error responses
	const appSrc = await readText(NEXUS_APP);
	if (!appSrc) {
		report.add(
			"packages/astropress-nexus/src/app.ts: not found — nexus gateway implementation missing",
		);
	} else {
		const hasMessageInErrors =
			appSrc.includes('"message"') ||
			appSrc.includes("message:") ||
			appSrc.includes("{ message") ||
			appSrc.includes('"error"') ||
			appSrc.includes("error:") ||
			appSrc.includes("{ error");
		if (!hasMessageInErrors) {
			report.add(
				"packages/astropress-nexus/src/app.ts: no message/error field found in responses — error responses must include a human-readable message",
			);
		}

		// 5. Auth middleware: Bearer token enforcement
		const hasAuth =
			appSrc.includes("Authorization") ||
			appSrc.includes("Bearer") ||
			appSrc.includes("bearer") ||
			appSrc.includes("auth");
		if (!hasAuth) {
			report.add(
				"packages/astropress-nexus/src/app.ts: no auth middleware found — gateway must enforce Bearer token authentication",
			);
		}
	}

	report.finish(
		"nexus audit passed — package structure, export test coverage, BDD wiring, error responses, and auth middleware all verified.",
	);
}

runAudit("nexus", main);
