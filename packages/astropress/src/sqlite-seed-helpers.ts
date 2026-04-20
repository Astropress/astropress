import { hashPasswordArgon2id } from "./crypto-primitives";
import type { SqliteDatabaseLike } from "./sqlite-bootstrap.js";
import { getTableColumns } from "./sqlite-schema-compat.js";

export function hashPasswordSync(password: string, iterations = 2) {
	return hashPasswordArgon2id(password, { iterations });
}

export function guessMimeType(pathname: string) {
	const lower = pathname.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	return "image/jpeg";
}

export function toSqlLiteral(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number" || typeof value === "bigint")
		return String(value);
	if (typeof value === "boolean") return value ? "1" : "0";
	if (value instanceof Uint8Array)
		return `X'${Buffer.from(value).toString("hex")}'`;
	return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildTableImportStatements(
	db: SqliteDatabaseLike,
	table: string,
) {
	const columns = getTableColumns(db, table);
	if (columns.length === 0) return [] as string[];

	const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<
		Record<string, unknown>
	>;
	const statements = [`DELETE FROM ${table};`];
	for (const row of rows) {
		const serializedValues = columns.map((column) => toSqlLiteral(row[column]));
		statements.push(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${serializedValues.join(", ")});`,
		);
	}
	return statements;
}

export function buildTableImportSql(db: SqliteDatabaseLike, table: string) {
	return buildTableImportStatements(db, table).join("\n");
}
