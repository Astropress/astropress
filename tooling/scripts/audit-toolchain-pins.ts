#!/usr/bin/env bun
/**
 * audit-toolchain-pins — assert that linter / formatter pins are consistent
 * across package.json devDependencies and every invocation site.
 *
 * Why this exists
 * ---------------
 * On 2026-04-25, two pre-commit attempts failed because `bunx biome`
 * (registry-latest, v2.x) and `bunx @biomejs/biome@1` enforced different
 * rules. Local pre-flight checks passed; lefthook's pre-commit step rejected
 * the same file. Cause: no pin in devDependencies + version-floating in
 * shell invocations.
 *
 * What it checks
 * --------------
 * For each pinned tool (currently Biome):
 *   1. devDependencies has the pin.
 *   2. Every shell invocation in lefthook.yml, .github/workflows/*.yml, and
 *      tooling/scripts/**.ts that calls the tool uses a major-pinned form
 *      (`bunx @biomejs/biome@<major>` or `bunx biome` with the local pin
 *      resolved via node_modules) — never bare `bunx biome` from the
 *      registry, which floats to whatever current `latest` is.
 *
 * Failure mode
 * ------------
 * Lists the offending file:line and proposes the corrected invocation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface ToolPin {
	package: string;
	allowedInvocations: RegExp[];
	bannedInvocations: { pattern: RegExp; reason: string }[];
}

const TOOLS: ToolPin[] = [
	{
		package: "@biomejs/biome",
		allowedInvocations: [
			// Pinned major form, e.g. `bunx @biomejs/biome@1 check ...`.
			/bunx\s+@biomejs\/biome@\d+/,
			// Local-resolved form via node_modules/.bin/biome.
			/node_modules\/\.bin\/biome\b/,
		],
		bannedInvocations: [
			{
				// Bare `bunx biome` resolves to whatever the registry currently
				// publishes as `biome` (which is biomejs's v2 alias). Different
				// rules, silent skew.
				pattern: /bunx\s+biome\b/,
				reason:
					"Bare `bunx biome` resolves to registry-latest (currently v2.x) and bypasses the @biomejs/biome@1 pin used by lefthook.",
			},
			{
				// Some authors write `bun x` instead of `bunx`.
				pattern: /bun\s+x\s+biome\b/,
				reason:
					"Bare `bun x biome` resolves to registry-latest and bypasses the version pin.",
			},
		],
	},
];

function loadPackageJson(): { devDependencies?: Record<string, string> } {
	return JSON.parse(readFileSync("package.json", "utf8")) as {
		devDependencies?: Record<string, string>;
	};
}

function walk(dir: string, exts: string[]): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
			out.push(...walk(full, exts));
		} else if (entry.isFile()) {
			if (exts.some((e) => entry.name.endsWith(e))) {
				out.push(full);
			}
		}
	}
	return out;
}

// The audit script itself has to mention the banned patterns in its own
// documentation and rule definitions — exclude it from the scan to avoid
// matching ourselves.
const SELF_PATH = "tooling/scripts/audit-toolchain-pins.ts";

function scanFiles(): string[] {
	const candidates: string[] = [];
	if (existsSync("lefthook.yml")) candidates.push("lefthook.yml");
	if (existsSync(".github/workflows")) {
		for (const f of readdirSync(".github/workflows")) {
			if (f.endsWith(".yml") || f.endsWith(".yaml")) {
				candidates.push(`.github/workflows/${f}`);
			}
		}
	}
	if (existsSync("tooling")) {
		candidates.push(...walk("tooling", [".ts", ".sh", ".mjs", ".js"]));
	}
	if (existsSync("package.json")) candidates.push("package.json");
	return candidates.filter((p) => p !== SELF_PATH && statSync(p).isFile());
}

// Lines whose first non-whitespace char is a comment marker — these contain
// banned patterns as documentation, not as live invocations.
function isCommentLine(line: string): boolean {
	const trimmed = line.trimStart();
	return (
		trimmed.startsWith("//") ||
		trimmed.startsWith("*") ||
		trimmed.startsWith("#")
	);
}

function main(): number {
	const pkg = loadPackageJson();
	const errors: string[] = [];

	for (const tool of TOOLS) {
		const pin = pkg.devDependencies?.[tool.package];
		if (!pin) {
			errors.push(
				`  ${tool.package}: not in devDependencies. Add a pinned version (e.g. "1.9.4") so every invocation resolves to a single major.`,
			);
		}
	}

	const files = scanFiles();
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		const lines = text.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (isCommentLine(line)) continue;
			for (const tool of TOOLS) {
				for (const banned of tool.bannedInvocations) {
					if (banned.pattern.test(line)) {
						errors.push(
							`  ${file}:${i + 1}: banned invocation\n    ${line.trim()}\n    Reason: ${banned.reason}`,
						);
					}
				}
			}
		}
	}

	if (errors.length === 0) {
		console.log(
			`audit-toolchain-pins passed — ${TOOLS.length} pinned tool(s) consistently invoked across ${files.length} files.`,
		);
		return 0;
	}

	console.error("\n✖ audit-toolchain-pins FAILED:\n");
	for (const e of errors) console.error(e);
	console.error(
		"\n  Replace bare invocations with a pinned form: `bunx @biomejs/biome@<major> ...` or use the local node_modules/.bin/<tool>.\n",
	);
	return 1;
}

process.exit(main());
