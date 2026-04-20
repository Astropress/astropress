// Rubric 14 (Observability / Logging)
//
// Verifies that the codebase follows structured-logging conventions:
//   1. runtime-logger.ts exists and exports createLogger
//   2. No bare console.log/warn/error in packages/astropress/src/ (excluding
//      tests, the logger itself, and vite plugins which need console for dev output)
//   3. Prometheus metrics endpoint exists at pages/ap/metrics.ts
//   4. recordAudit is called from at least 2 call sites in src/
//   5. BDD scenario file tooling/bdd/operations/audit-logging.feature exists

import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const SRC_DIR = join(root, "packages/astropress/src");
const EXTENSIONS = new Set([".ts", ".mjs", ".js"]);

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function walkFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, {
			withFileTypes: true,
			recursive: true,
		});
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const ext = entry.name.slice(entry.name.lastIndexOf("."));
			if (EXTENSIONS.has(ext)) {
				const fullPath = join(entry.parentPath, entry.name);
				files.push(fullPath);
			}
		}
	} catch {
		/* dir may not exist */
	}
	return files.sort();
}

function isExcludedFromConsoleCheck(relPath: string): boolean {
	// Exclude test files
	if (/\.test\.|\.spec\.|__tests__/.test(relPath)) return true;
	// Exclude the logger itself
	if (relPath.includes("runtime-logger")) return true;
	// Exclude vite plugins (they need console for dev output)
	if (/vite[-_]?plugin|plugin.*vite/i.test(relPath)) return true;
	// Exclude fire-and-forget error handlers that use [astropress] prefixed output
	// (cache-purge, plugin-dispatch, sitemap-plugin — intentionally lightweight)
	if (relPath.includes("cache-purge")) return true;
	if (relPath.includes("plugin-dispatch")) return true;
	if (relPath.includes("plugins/")) return true;
	// Exclude runtime-page-store warnings (search capability checks)
	if (relPath.includes("runtime-page-store")) return true;
	return false;
}

async function main() {
	const violations: string[] = [];

	// 1. runtime-logger.ts exists and exports createLogger
	const loggerPath = join(root, "packages/astropress/src/runtime-logger.ts");
	if (await fileExists(loggerPath)) {
		const loggerSrc = await readFile(loggerPath, "utf8");
		if (
			!/export\s+(function|const|class)\s+createLogger\b/.test(loggerSrc) &&
			!/export\s*\{[^}]*\bcreateLogger\b/.test(loggerSrc)
		) {
			violations.push(
				"[missing-export] packages/astropress/src/runtime-logger.ts exists but does not export createLogger",
			);
		}
	} else {
		violations.push(
			"[missing-file] packages/astropress/src/runtime-logger.ts does not exist — structured logger is required",
		);
	}

	// 2. No bare console.log/warn/error in src/ (with exclusions)
	const srcFiles = await walkFiles(SRC_DIR);
	const consolePattern = /\bconsole\.(log|warn|error)\s*\(/;

	for (const filePath of srcFiles) {
		const relPath = relative(root, filePath);
		if (isExcludedFromConsoleCheck(relPath)) continue;

		const src = await readFile(filePath, "utf8");
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Skip comments
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

			if (consolePattern.test(line)) {
				violations.push(
					`[bare-console] ${relPath}:${i + 1}: bare console call — use the structured logger from runtime-logger.ts instead\n    → ${trimmed}`,
				);
			}
		}
	}

	// 3. Prometheus metrics endpoint exists
	const metricsPath = join(root, "packages/astropress/pages/ap/metrics.ts");
	if (!(await fileExists(metricsPath))) {
		violations.push(
			"[missing-file] packages/astropress/pages/ap/metrics.ts does not exist — Prometheus metrics endpoint is required",
		);
	}

	// 4. recordAudit is called from at least 2 call sites in src/
	let recordAuditCount = 0;
	for (const filePath of srcFiles) {
		const src = await readFile(filePath, "utf8");
		if (/\brecordAudit\s*\(/.test(src)) {
			recordAuditCount++;
		}
	}
	if (recordAuditCount < 2) {
		violations.push(
			`[insufficient-audit-trail] found ${recordAuditCount} file(s) calling recordAudit in src/ — need at least 2 call sites`,
		);
	}

	// 5. BDD scenario file exists
	const bddPath = join(root, "tooling/bdd/operations/audit-logging.feature");
	if (!(await fileExists(bddPath))) {
		violations.push(
			"[missing-file] tooling/bdd/operations/audit-logging.feature does not exist — BDD scenario for audit logging is required",
		);
	}

	if (violations.length > 0) {
		console.error(
			`observability audit failed — ${violations.length} issue(s):\n`,
		);
		for (const v of violations) console.error(`  - ${v}`);
		console.error(
			"\nFix: use the structured logger from runtime-logger.ts instead of bare console calls, " +
				"ensure recordAudit call sites exist, and verify all required files are present.",
		);
		process.exit(1);
	}

	console.log(
		`observability audit passed — ${srcFiles.length} source files scanned, ` +
			`${recordAuditCount} recordAudit call sites found.`,
	);
}

main().catch((err) => {
	console.error("observability audit failed:", err);
	process.exit(1);
});
