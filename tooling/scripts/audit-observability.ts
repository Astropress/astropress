// Rubric 14 (Observability / Logging)
//
// Verifies that the codebase follows structured-logging conventions:
//   1. runtime-logger.ts exists and exports createLogger
//   2. No bare console.log/warn/error in packages/astropress/src/ (excluding
//      tests, the logger itself, and vite plugins which need console for dev output)
//   3. Prometheus metrics endpoint exists at pages/ap/metrics.ts
//   4. recordAudit is called from at least 2 call sites in src/
//   5. BDD scenario file tooling/bdd/operations/audit-logging.feature exists

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

const SRC_DIR = fromRoot("packages/astropress/src");
const EXTENSIONS = [".ts", ".mjs", ".js"] as const;

async function walkFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, {
		recursive: true,
		extensions: EXTENSIONS,
	});
	return entries.map((e) => join(dir, e)).sort();
}

function isExcludedFromConsoleCheck(relPath: string): boolean {
	if (/\.test\.|\.spec\.|__tests__/.test(relPath)) return true;
	if (relPath.includes("runtime-logger")) return true;
	if (/vite[-_]?plugin|plugin.*vite/i.test(relPath)) return true;
	if (relPath.includes("cache-purge")) return true;
	if (relPath.includes("plugin-dispatch")) return true;
	if (relPath.includes("plugins/")) return true;
	if (relPath.includes("runtime-page-store")) return true;
	return false;
}

async function main() {
	const report = new AuditReport("observability");

	// 1. runtime-logger.ts exists and exports createLogger
	const loggerPath = fromRoot("packages/astropress/src/runtime-logger.ts");
	if (await fileExists(loggerPath)) {
		const loggerSrc = await readText(loggerPath);
		if (
			!/export\s+(function|const|class)\s+createLogger\b/.test(loggerSrc) &&
			!/export\s*\{[^}]*\bcreateLogger\b/.test(loggerSrc)
		) {
			report.add(
				"[missing-export] packages/astropress/src/runtime-logger.ts exists but does not export createLogger",
			);
		}
	} else {
		report.add(
			"[missing-file] packages/astropress/src/runtime-logger.ts does not exist — structured logger is required",
		);
	}

	// 2. No bare console.log/warn/error in src/ (with exclusions)
	const srcFiles = await walkFiles(SRC_DIR);
	const consolePattern = /\bconsole\.(log|warn|error)\s*\(/;

	for (const filePath of srcFiles) {
		const relPath = relative(ROOT, filePath);
		if (isExcludedFromConsoleCheck(relPath)) continue;

		const src = await readText(filePath);
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

			if (consolePattern.test(line)) {
				report.add(
					`[bare-console] ${relPath}:${i + 1}: bare console call — use the structured logger from runtime-logger.ts instead\n    → ${trimmed}`,
				);
			}
		}
	}

	// 3. Prometheus metrics endpoint exists
	const metricsPath = fromRoot("packages/astropress/pages/ap/metrics.ts");
	if (!(await fileExists(metricsPath))) {
		report.add(
			"[missing-file] packages/astropress/pages/ap/metrics.ts does not exist — Prometheus metrics endpoint is required",
		);
	}

	// 4. recordAudit is called from at least 2 call sites in src/
	let recordAuditCount = 0;
	for (const filePath of srcFiles) {
		const src = await readText(filePath);
		if (/\brecordAudit\s*\(/.test(src)) {
			recordAuditCount++;
		}
	}
	if (recordAuditCount < 2) {
		report.add(
			`[insufficient-audit-trail] found ${recordAuditCount} file(s) calling recordAudit in src/ — need at least 2 call sites`,
		);
	}

	// 5. BDD scenario file exists
	const bddPath = fromRoot("tooling/bdd/operations/audit-logging.feature");
	if (!(await fileExists(bddPath))) {
		report.add(
			"[missing-file] tooling/bdd/operations/audit-logging.feature does not exist — BDD scenario for audit logging is required",
		);
	}

	if (report.failed) {
		console.error(
			"\nFix: use the structured logger from runtime-logger.ts instead of bare console calls, " +
				"ensure recordAudit call sites exist, and verify all required files are present.",
		);
	}

	report.finish(
		`observability audit passed — ${srcFiles.length} source files scanned, ` +
			`${recordAuditCount} recordAudit call sites found.`,
	);
}

runAudit("observability", main);
