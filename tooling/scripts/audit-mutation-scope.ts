// Audit that every security-critical source file is covered by at least one
// Stryker config's `mutate` glob. The 2026-04-22 post-cleanup surfaced that
// stryker-critical.config.mjs had a hardcoded file list which hadn't kept up
// with new auth-*.ts files.
//
// Critical prefixes (expanded via glob match inside stryker-critical):
//   src/security-*.ts
//   src/auth-*.ts
//   src/runtime-admin-*.ts
// Each existing file matching these patterns must be in mutate[] of at least
// one stryker config — either by explicit path or by a containing glob.

import { readdirSync } from "node:fs";
import {
	AuditReport,
	fromRoot,
	readText,
	runAudit,
} from "../lib/audit-utils.js";

const CRITICAL_PATTERNS: Array<{ prefix: string; label: string }> = [
	{ prefix: "security-", label: "security" },
	{ prefix: "auth-", label: "auth" },
	{ prefix: "runtime-admin-", label: "runtime-admin" },
];

const STRYKER_CONFIGS = [
	"tooling/stryker/stryker.config.mjs",
	"tooling/stryker/stryker-critical.config.mjs",
	"tooling/stryker/stryker-sync.config.mjs",
	"tooling/stryker/stryker-audit-utils.config.mjs",
	"tooling/stryker/stryker-pending-form.config.mjs",
];

function isCovered(srcPath: string, mutateGlobs: string[]): boolean {
	for (const glob of mutateGlobs) {
		// Simple glob-to-regex translator: escape regex specials, then replace
		// ** with '.*', * with '[^/]*', ? with '.'
		const pattern = glob
			.replace(/[.+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*\*/g, "§§DOUBLE§§")
			.replace(/\*/g, "[^/]*")
			.replace(/§§DOUBLE§§/g, ".*")
			.replace(/\?/g, ".");
		if (new RegExp(`^${pattern}$`).test(srcPath)) return true;
	}
	return false;
}

function parseMutateGlobs(configSrc: string): string[] {
	// Match the `mutate: [ ... ]` array; extract quoted strings within
	const match = configSrc.match(/mutate:\s*\[([\s\S]*?)\]/);
	if (!match) return [];
	const body = match[1];
	const globs: string[] = [];
	for (const m of body.matchAll(/"([^"]+)"/g)) {
		// Drop exclusion patterns that start with "!"
		if (m[1].startsWith("!")) continue;
		globs.push(m[1]);
	}
	return globs;
}

async function main() {
	const report = new AuditReport("mutation-scope");

	// Load all stryker mutate globs, tagged by source config
	const allGlobs: Array<{ config: string; globs: string[] }> = [];
	for (const configFile of STRYKER_CONFIGS) {
		const src = await readText(fromRoot(configFile));
		if (!src) continue;
		const globs = parseMutateGlobs(src);
		if (globs.length > 0) allGlobs.push({ config: configFile, globs });
	}

	if (allGlobs.length === 0) {
		report.add("no stryker configs with mutate[] found");
		report.finish("mutation-scope audit unreachable");
	}

	// Enumerate files matching critical prefixes under src/
	const srcDir = fromRoot("packages/astropress/src");
	let entries: string[] = [];
	try {
		entries = readdirSync(srcDir);
	} catch {
		report.add(`packages/astropress/src not found`);
		report.finish("mutation-scope audit unreachable");
	}

	const criticalFiles: Array<{ path: string; label: string }> = [];
	for (const entry of entries) {
		if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) continue;
		for (const pattern of CRITICAL_PATTERNS) {
			if (entry.startsWith(pattern.prefix)) {
				// Stryker configs use globs relative to packages/astropress/, so
				// `src/foo.ts` is the form we must match against.
				criticalFiles.push({ path: `src/${entry}`, label: pattern.label });
				break;
			}
		}
	}

	// For each critical file, verify coverage
	const uncovered: Array<{ path: string; label: string }> = [];
	for (const file of criticalFiles) {
		let covered = false;
		for (const { globs } of allGlobs) {
			if (isCovered(file.path, globs)) {
				covered = true;
				break;
			}
		}
		if (!covered) uncovered.push(file);
	}

	for (const u of uncovered) {
		report.add(
			`[uncovered] ${u.path} (${u.label}-critical) is not matched by any stryker config's mutate[]. ` +
				`Add it to stryker-critical.config.mjs via a wildcard like "src/${u.label}-*.ts".`,
		);
	}

	report.finish(
		`mutation-scope audit passed — ${criticalFiles.length} critical files checked; ` +
			`all covered by ${allGlobs.length} stryker config(s).`,
	);
}

runAudit("mutation-scope", main);
