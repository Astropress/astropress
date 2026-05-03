#!/usr/bin/env bun
/**
 * audit-schema-migration-robustness — surface drift between the SQLite
 * baseline schema and the D1 migration paths, plus migration directory
 * gaps (.down.sql companions).
 *
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SQLITE_SCHEMA = "packages/astropress/src/sqlite-schema.sql";
const OUT = "tooling/audit-output/schema-migration-robustness.json";

function tablesIn(sql: string): string[] {
	return [...sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)/gi)]
		.map((m) => m[1])
		.sort();
}

function listMigrations(dir: string): { up: string[]; downs: string[] } {
	if (!existsSync(dir)) return { up: [], downs: [] };
	const all = execFileSync("bash", ["-c", `find ${dir} -name "*.sql"`], {
		encoding: "utf8",
	})
		.split("\n")
		.filter(Boolean);
	return {
		up: all.filter((p) => !p.endsWith(".down.sql")).sort(),
		downs: all.filter((p) => p.endsWith(".down.sql")).sort(),
	};
}

const sqliteSchema = readFileSync(SQLITE_SCHEMA, "utf8");
const sqliteTables = tablesIn(sqliteSchema);

// D1 path: collect CREATE TABLE strings from any d1-*.ts file source.
const d1Sources = execFileSync(
	"bash",
	["-c", "cat packages/astropress/src/d1-*.ts 2>/dev/null"],
	{ encoding: "utf8" },
);
const d1Tables = [...new Set(tablesIn(d1Sources))];

const onlyInSqlite = sqliteTables.filter((t) => !d1Tables.includes(t));
const onlyInD1 = d1Tables.filter((t) => !sqliteTables.includes(t));

// Migration .down.sql companions (host migrations dir does not yet exist
// in the framework — this is the host-app contract; framework only ships
// the baseline schema).
const migrations = listMigrations("packages/astropress/migrations");
const missingDowns: string[] = [];
for (const up of migrations.up) {
	const expected = up.replace(/\.sql$/, ".down.sql");
	if (!migrations.downs.includes(expected)) missingDowns.push(up);
}

const report = {
	generatedAt: new Date().toISOString(),
	sqliteTableCount: sqliteTables.length,
	d1TableCount: d1Tables.length,
	tablesOnlyInSqlite: onlyInSqlite,
	tablesOnlyInD1: onlyInD1,
	hostMigrations: {
		upFiles: migrations.up.length,
		downFiles: migrations.downs.length,
		missingDownCompanions: missingDowns,
	},
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`schema-migration: sqlite-tables=${sqliteTables.length} d1-tables=${d1Tables.length} sqlite-only=${onlyInSqlite.length} d1-only=${onlyInD1.length}`,
);
