#!/usr/bin/env bun
/**
 * audit-suppression-warnings — non-blocking warning lint for suppression
 * comments (Stryker disable, v8 ignore, biome-ignore, eslint-disable,
 * @ts-ignore / @ts-expect-error).
 *
 * Suppressions silence quality signals. Each one represents either:
 *  (a) an equivalent mutant / unreachable branch that ought to be deleted
 *      from the source rather than annotated, or
 *  (b) a real coverage gap that someone decided not to fix.
 *
 * This audit prints a warning per suppression and ALWAYS exits 0 — it does
 * not block the commit. The intent is to make suppressions visible at
 * commit time so the author considers a code-level fix instead.
 */

import { readFileSync } from "node:fs";

const PATTERNS: { name: string; regex: RegExp }[] = [
	{ name: "Stryker disable", regex: /Stryker disable/ },
	{ name: "v8 ignore", regex: /v8 ignore/ },
	{ name: "biome-ignore", regex: /biome-ignore/ },
	{ name: "eslint-disable", regex: /eslint-disable/ },
	{ name: "@ts-ignore", regex: /@ts-ignore/ },
	{ name: "@ts-expect-error", regex: /@ts-expect-error/ },
	{ name: "istanbul ignore", regex: /istanbul ignore/ },
];

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (args.length === 0) {
	process.exit(0);
}

const findings: {
	file: string;
	line: number;
	pattern: string;
	text: string;
}[] = [];

for (const file of args) {
	let source: string;
	try {
		source = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const { name, regex } of PATTERNS) {
			if (regex.test(line)) {
				findings.push({
					file,
					line: i + 1,
					pattern: name,
					text: line.trim().slice(0, 100),
				});
			}
		}
	}
}

if (findings.length === 0) {
	process.exit(0);
}

console.warn(
	`\n⚠ suppression-warnings: ${findings.length} suppression comment(s) in staged files`,
);
console.warn(
	"  Suppressions silence quality signals. Prefer fixing the underlying issue:",
);
console.warn(
	"  • Equivalent Stryker mutant?  Often the source has a redundant guard worth deleting.",
);
console.warn(
	"  • v8 / istanbul ignore?       The branch may be unreachable — remove the dead code.",
);
console.warn(
	"  • biome-ignore / @ts-ignore?  Address the lint/type error rather than silencing it.\n",
);
for (const f of findings) {
	console.warn(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.text}`);
}
console.warn(
	"\n  This is a warning, not a failure — the commit will proceed.\n",
);

process.exit(0);
