#!/usr/bin/env bun
/**
 * audit-followup-marker — list every `audit-followup: <id>` marker in the
 * repo so deferred work stays visible.
 *
 * Convention: when a workstream surfaces an adjacent issue that can't be
 * fixed in the current commit, the author drops a comment of the form
 *   // audit-followup: <short-id> — <one-line description>
 * (or `# audit-followup:` for shell, `<!-- audit-followup: -->` for HTML)
 * and adds a one-line entry to tooling/audit-output/SUMMARY.md "Found
 * during fix" appendix. This script greps for the markers and prints a
 * file:line:description list so a future PR can clear them.
 *
 * Exit code:
 *   --gate (default in pre-push): exit 1 if any marker exists. Markers are
 *     visible work — the gate forces them to be tracked or resolved, not
 *     accumulated silently.
 *   no flag: exit 0, print the inventory only (use for ad-hoc auditing).
 */

import { execFileSync } from "node:child_process";

const RE = /audit-followup:\s*([^\s]+)\s*(?:[—\-:]\s*(.*))?$/;

interface Hit {
	file: string;
	line: number;
	id: string;
	description: string;
}

function findMarkers(): Hit[] {
	const out = execFileSync(
		"bash",
		[
			"-c",
			// Exclude this script and the SUMMARY appendix to avoid self-matches.
			'git ls-files | grep -vE "(audit-followup-marker\\.ts|audit-output/SUMMARY\\.md)$" | xargs grep -nE "audit-followup:" 2>/dev/null || true',
		],
		{ encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
	);
	const hits: Hit[] = [];
	for (const raw of out.split("\n")) {
		if (!raw) continue;
		const m = raw.match(/^([^:]+):(\d+):(.*)$/);
		if (!m) continue;
		const [, file, line, rest] = m;
		const idMatch = rest.match(RE);
		if (!idMatch) continue;
		hits.push({
			file,
			line: Number(line),
			id: idMatch[1],
			description: (idMatch[2] ?? "").trim(),
		});
	}
	return hits.sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
	);
}

const gate = !process.argv.includes("--list-only");
const hits = findMarkers();

if (hits.length === 0) {
	console.log("audit-followup-marker: 0 open markers.");
	process.exit(0);
}

console.log(`audit-followup-marker: ${hits.length} open marker(s):\n`);
for (const h of hits) {
	console.log(
		`  ${h.file}:${h.line}  [${h.id}]${h.description ? ` — ${h.description}` : ""}`,
	);
}

if (gate) {
	console.error(
		`\n✖ ${hits.length} open audit-followup marker(s). Resolve them or pass --list-only for an audit-only run.`,
	);
	process.exit(1);
}
process.exit(0);
