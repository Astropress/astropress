/**
 * Security Policy Integrity Audit — Rubric 57 (User-Facing Visual Integrity)
 *
 * Scans all user-facing source files for security-policy flags that must be
 * environment-aware rather than hardcoded booleans.
 */

import { join, relative } from "node:path";
import {
	AuditReport,
	fromRoot,
	listFiles,
	readText,
	ROOT,
	runAudit,
} from "../lib/audit-utils.js";

const SCAN_DIRS = [
	fromRoot("packages/astropress/src"),
	fromRoot("packages/astropress/components"),
	fromRoot("packages/astropress/pages"),
	fromRoot("examples"),
];

const EXTENSIONS = [".ts", ".astro", ".mjs", ".js"] as const;

const ENV_AWARE_FLAGS: Array<[string, RegExp, RegExp]> = [
	[
		"allowInlineStyles",
		/allowInlineStyles\s*:\s*true\b/,
		/allowInlineStyles\s*:\s*false\b/,
	],
	[
		"allowInlineScripts",
		/allowInlineScripts\s*:\s*true\b/,
		/allowInlineScripts\s*:\s*false\b/,
	],
];

const TYPE_DEFINITION_FILES = new Set([
	"security-headers.ts",
	"security-middleware.ts",
]);

function isTestFile(path: string): boolean {
	return (
		path.includes(".test.") ||
		path.includes(".spec.") ||
		path.includes("/tests/")
	);
}

async function walkFiles(dir: string): Promise<string[]> {
	const entries = await listFiles(dir, {
		recursive: true,
		extensions: EXTENSIONS,
	});
	return entries.map((e) => join(dir, e)).sort();
}

function isTypeDefinition(filePath: string): boolean {
	const filename = filePath.split("/").pop() ?? "";
	return TYPE_DEFINITION_FILES.has(filename);
}

async function main() {
	const report = new AuditReport("security-policy-integrity");
	const allDirs = await Promise.all(SCAN_DIRS.map((d) => walkFiles(d)));
	const files = allDirs.flat();

	for (const filePath of files) {
		if (isTestFile(filePath)) continue;
		if (isTypeDefinition(filePath)) continue;

		const relPath = relative(ROOT, filePath);
		const src = await readText(filePath);
		const lines = src.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			for (const [flagName, truePattern, falsePattern] of ENV_AWARE_FLAGS) {
				if (truePattern.test(line)) {
					report.add(
						`[hardcoded-true] ${relPath}:${i + 1}: ${flagName}: true — use import.meta.env.DEV instead\n    → ${line.trim()}`,
					);
				}
				if (falsePattern.test(line)) {
					report.add(
						`[hardcoded-false] ${relPath}:${i + 1}: ${flagName}: false — use import.meta.env.DEV instead\n    → ${line.trim()}`,
					);
				}
			}
		}
	}

	if (report.failed) {
		console.error(
			"\nFix: replace hardcoded true/false with import.meta.env.DEV — " +
				"this allows relaxed policies in dev mode only, keeping production secure.",
		);
	}

	report.finish(
		`security-policy-integrity audit passed — ${files.length} files scanned, no hardcoded security-policy flags.`,
	);
}

runAudit("security-policy-integrity", main);
