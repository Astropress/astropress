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
	// Three real-world access patterns:
	//   getAdminLabel("key", locale)         — direct lookup
	//   adminUi.labels.key / .labels.key     — resolved bag
	//   tr("key", fallback)                  — local helper inside admin-ui
	//                                          (parameter typed as AdminLabelKey)
	// The `tr(` form is the dominant pattern — it produces the resolved bag.
	// Exclude only admin-labels.ts (declaration site). admin-ui.ts contains the
	// resolver which calls tr("key", fallback) for every key — those calls ARE
	// the use sites that pipe labels into the resolved bag.
	const out = execFileSync(
		"bash",
		[
			"-c",
			'grep -rEhn --exclude=admin-labels.ts \'getAdminLabel\\(|\\.labels\\.[a-zA-Z]+|\\btr\\("[A-Za-z0-9_]+"|keys\\.has\\("[A-Za-z0-9_]+"\' packages/astropress/{src,components,pages,tests} 2>/dev/null || true',
		],
		{ encoding: "utf8" },
	);
	const staticKeys = new Set<string>();
	const dynamic: string[] = [];
	const dotLabel = /\.labels\.([a-zA-Z][a-zA-Z0-9_]*)/g;
	const trCall = /\btr\(\s*"([A-Za-z0-9_]+)"/g;
	const keysHas = /\bkeys\.has\(\s*"([A-Za-z0-9_]+)"/g;
	for (const line of out.split("\n")) {
		if (!line) continue;
		for (const m of line.matchAll(dotLabel)) staticKeys.add(m[1]);
		for (const m of line.matchAll(trCall)) staticKeys.add(m[1]);
		for (const m of line.matchAll(keysHas)) staticKeys.add(m[1]);
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
		// Skip lines that are documentation comments or the declaration itself.
		const isComment = /^\s*\d+:\s*\*/.test(line);
		const isDecl = /function\s+getAdminLabel\s*\(/.test(line);
		// admin-ui.ts internally calls getAdminLabel(key, locale) where `key` is
		// the typed parameter — TS guarantees a valid AdminLabelKey at every
		// caller, so this self-call is not a runtime risk and is already
		// represented by the upstream tr("...") sites.
		const isSelfCall = /getAdminLabel\(\s*key\s*,/.test(line);
		if (
			!isComment &&
			!isDecl &&
			!isSelfCall &&
			/getAdminLabel\(/.test(line) &&
			!/getAdminLabel\(\s*"/.test(line) &&
			!/getAdminLabel\(\s*`/.test(line)
		) {
			dynamic.push(line.trim());
		}
	}
	// Multi-line tr( call: the per-line grep misses tr(\n  "key",\n  fb).
	// Re-scan admin-ui.ts whole-file to catch the resolver's wrapped calls.
	const adminUi = readFileSync("packages/astropress/src/admin-ui.ts", "utf8");
	for (const m of adminUi.matchAll(/\btr\(\s*"([A-Za-z0-9_]+)"/g)) {
		staticKeys.add(m[1]);
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

// Gate: any dead label key OR any dynamic call site fails.
// Why dynamic too: a `getAdminLabel(variable)` can silently return the literal
// key string on miss, masking i18n regressions. Force every call to be statically
// resolvable so CI knows what's referenced.
if (unused.length > 0 || dynamicCalls.length > 0) {
	console.error(
		`label-coverage FAIL: ${unused.length} dead label key(s), ${dynamicCalls.length} dynamic call site(s).`,
	);
	if (unused.length > 0) {
		console.error("Dead keys (defined in AdminLabelKey but never read):");
		for (const k of unused) console.error(`  - ${k}`);
		console.error(
			"Delete these from packages/astropress/src/admin-labels.ts (union + each per-locale map).",
		);
	}
	if (dynamicCalls.length > 0) {
		console.error("Dynamic call sites (must be static literal strings):");
		for (const c of dynamicCalls) console.error(`  - ${c}`);
	}
	process.exit(1);
}
