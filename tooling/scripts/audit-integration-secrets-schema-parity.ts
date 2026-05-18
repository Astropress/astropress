#!/usr/bin/env bun
/**
 * audit-integration-secrets-schema-parity — fail CI when the SQL
 * bodies in `sqlite-runtime/integrations.ts` and
 * `sqlite-runtime/integrations-d1.ts` drift.
 *
 * Both files hold seven SQL bodies (FIND_STATUS, LIST_STATUSES,
 * UPSERT_STATUS, UPDATE_STATUS, DISCONNECT, FIND_SECRET,
 * UPSERT_SECRET, RESEAL_GUARDED, LIST_PREVIOUS_SECRETS). The audit
 * extracts the template-literal value of each and asserts the
 * normalised whitespace contents match.
 *
 * Normalisation: collapse whitespace runs to single spaces, trim.
 * That tolerates indentation changes while catching column-order
 * shuffles, ON CONFLICT differences, and kid-literal drift.
 *
 * If you legitimately need to change one body, you must change the
 * sibling in the same commit.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SQLITE_PATH = fileURLToPath(
	new URL("../../packages/astropress/src/sqlite-runtime/integrations.ts", import.meta.url),
);
const D1_PATH = fileURLToPath(
	new URL("../../packages/astropress/src/sqlite-runtime/integrations-d1.ts", import.meta.url),
);

const STATEMENT_KEYS = [
	"FIND_STATUS",
	"LIST_STATUSES",
	"UPSERT_STATUS",
	"UPDATE_STATUS",
	"DISCONNECT",
	"FIND_SECRET",
	"UPSERT_SECRET",
	"RESEAL_GUARDED",
	"LIST_PREVIOUS_SECRETS",
] as const;

type StatementKey = (typeof STATEMENT_KEYS)[number];

function normalise(sql: string): string {
	return sql.replace(/\s+/g, " ").trim();
}

function extract(filePath: string, prefix: string): Record<StatementKey, string> {
	const src = readFileSync(filePath, "utf8");
	const out: Partial<Record<StatementKey, string>> = {};
	for (const key of STATEMENT_KEYS) {
		const constName = `${prefix}SQL_${key}`;
		// Match `const <constName> = \`...\`` non-greedy — multi-line
		// backtick string up to the next unescaped backtick. The keys
		// are kept distinct so each body is extracted independently.
		const re = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=\\s*\`([\\s\\S]*?)\``, "m");
		const m = re.exec(src);
		if (!m) {
			throw new Error(
				`audit-integration-secrets-schema-parity: ${constName} not found in ${filePath}`,
			);
		}
		out[key] = m[1];
	}
	return out as Record<StatementKey, string>;
}

function main(): void {
	const sqlite = extract(SQLITE_PATH, "");
	const d1 = extract(D1_PATH, "D1_");

	const drifts: Array<{ key: StatementKey; sqlite: string; d1: string }> = [];
	for (const key of STATEMENT_KEYS) {
		const a = normalise(sqlite[key]);
		const b = normalise(d1[key]);
		if (a !== b) {
			drifts.push({ key, sqlite: a, d1: b });
		}
	}

	if (drifts.length === 0) {
		console.log(
			`audit-integration-secrets-schema-parity passed — ${STATEMENT_KEYS.length} statements aligned.`,
		);
		return;
	}

	console.error("\n✖ audit-integration-secrets-schema-parity FAILED:\n");
	for (const d of drifts) {
		console.error(`  Drift in SQL_${d.key}:`);
		console.error(`    sqlite: ${d.sqlite}`);
		console.error(`    d1    : ${d.d1}`);
		console.error("");
	}
	console.error(
		"  Both repository implementations must hold identical SQL bodies.\n" +
			"  Update the sibling in the same commit.\n",
	);
	process.exit(1);
}

main();
