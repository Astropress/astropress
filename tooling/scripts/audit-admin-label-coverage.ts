#!/usr/bin/env bun
/**
 * audit-admin-label-coverage — surface dead admin-label keys, unverified
 * dynamic-key call sites, and any per-locale gaps if the type contract is
 * weakened in future.
 *
 * The TS type Record<AdminLocale, Record<AdminLabelKey, string>> already
 * enforces locale completeness statically, but does NOT catch:
 *   - keys defined in AdminLabelKey but never read (dead labels)
 *   - getAdminLabel(`prefix-${variable}`) call sites (silently returns
 *     the literal stringified key on miss; runtime regression invisible)
 *
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LABELS_FILE = "packages/astropress/src/admin-labels.ts";
const OUT = "tooling/audit-output/admin-label-coverage.json";

function listLabelKeys(): string[] {
	const src = readFileSync(LABELS_FILE, "utf8");
	// Capture every | "keyName" between AdminLabelKey opening and closing.
	const m = src.match(/export type AdminLabelKey =([\s\S]*?);/);
	if (!m) return [];
	const keys = [...m[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((x) => x[1]);
	return [...new Set(keys)].sort();
}

function grepLiteralCallSites(): {
	staticKeys: Set<string>;
	dynamicCalls: string[];
} {
	// Two real-world access patterns:
	//   getAdminLabel("key", locale)  — direct lookup
	//   adminUi.labels.key / .labels.key — resolved bag (most common)
	const out = execFileSync(
		"bash",
		[
			"-c",
			"grep -rEhn 'getAdminLabel\\(|\\.labels\\.[a-zA-Z]+' packages/astropress/{src,components,pages} 2>/dev/null || true",
		],
		{ encoding: "utf8" },
	);
	const staticKeys = new Set<string>();
	const dynamic: string[] = [];
	const dotLabel = /\.labels\.([a-zA-Z][a-zA-Z0-9_]*)/g;
	for (const line of out.split("\n")) {
		if (!line) continue;
		for (const m of line.matchAll(dotLabel)) staticKeys.add(m[1]);
		const literal = line.match(/getAdminLabel\(\s*"([A-Za-z0-9_]+)"/);
		if (literal) {
			staticKeys.add(literal[1]);
			continue;
		}
		const tmpl = line.match(/getAdminLabel\(\s*`([^`$]+)`/);
		if (tmpl) {
			staticKeys.add(tmpl[1]);
			continue;
		}
		// Variable or template-with-substitution = dynamic call site.
		if (/getAdminLabel\(/.test(line)) dynamic.push(line.trim());
	}
	return { staticKeys, dynamicCalls: dynamic };
}

const definedKeys = listLabelKeys();
const { staticKeys, dynamicCalls } = grepLiteralCallSites();

const definedSet = new Set(definedKeys);
const unused = definedKeys.filter((k) => !staticKeys.has(k));
const undefinedAtCall = [...staticKeys].filter((k) => !definedSet.has(k));

const report = {
	generatedAt: new Date().toISOString(),
	definedKeyCount: definedKeys.length,
	staticCallSiteKeyCount: staticKeys.size,
	dynamicCallSiteCount: dynamicCalls.length,
	deadLabelKeys: unused,
	stringlyKeysNotInType: undefinedAtCall,
	dynamicCallSites: dynamicCalls,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`label-coverage: defined=${definedKeys.length} static-calls=${staticKeys.size} dead=${unused.length} dynamic-calls=${dynamicCalls.length}`,
);
