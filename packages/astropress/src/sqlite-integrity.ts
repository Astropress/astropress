import {
	type SqliteDatabaseLike,
	loadSqliteDatabase,
} from "./sqlite-bootstrap-helpers";

export type IntegrityStatus = "ok" | "corrupt" | "unavailable";

export interface IntegrityCheckResult {
	status: IntegrityStatus;
	mode: "quick" | "full";
	messages: string[];
	error?: string;
}

export interface IntegrityCheckOptions {
	mode?: "quick" | "full";
}

function readPragma(db: SqliteDatabaseLike, mode: "quick" | "full"): string[] {
	const sql = mode === "full" ? "PRAGMA integrity_check" : "PRAGMA quick_check";
	const rows = db.prepare(sql).all() as Record<string, unknown>[];
	return rows.map((row) => {
		const first = Object.values(row)[0];
		return typeof first === "string" ? first : String(first);
	});
}

export function runIntegrityCheckOnOpenDatabase(
	db: SqliteDatabaseLike,
	options: IntegrityCheckOptions = {},
): IntegrityCheckResult {
	const mode = options.mode ?? "quick";
	try {
		const messages = readPragma(db, mode);
		const ok = messages.length === 1 && messages[0]?.toLowerCase() === "ok";
		return {
			status: ok ? "ok" : "corrupt",
			mode,
			messages,
		};
	} catch (error) {
		return {
			status: "unavailable",
			mode,
			messages: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function runIntegrityCheck(
	sqlitePath: string,
	options: IntegrityCheckOptions = {},
): Promise<IntegrityCheckResult> {
	const mode = options.mode ?? "quick";
	let DbClass: Awaited<ReturnType<typeof loadSqliteDatabase>>;
	try {
		DbClass = await loadSqliteDatabase();
	} catch (error) {
		return {
			status: "unavailable",
			mode,
			messages: [],
			error: `SQLite driver unavailable: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	let db: SqliteDatabaseLike | undefined;
	try {
		db = new DbClass(sqlitePath);
		return runIntegrityCheckOnOpenDatabase(db, { mode });
	} catch (error) {
		return {
			status: "unavailable",
			mode,
			messages: [],
			error: `Failed to open database at ${sqlitePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	} finally {
		db?.close();
	}
}

export interface RepairResult {
	repaired: boolean;
	mode: "dump-replay" | "none";
	messages: string[];
	error?: string;
}

/**
 * Attempt to reconstruct a corrupt SQLite database by dumping its readable
 * contents into a new file via `.dump`-style iteration and swapping it in.
 *
 * Caller is expected to close any open handles to `sqlitePath` first. The
 * original file is preserved at `<sqlitePath>.corrupt-<timestamp>` on success.
 */
export async function attemptRepair(sqlitePath: string): Promise<RepairResult> {
	const { renameSync, rmSync } = await import("node:fs");
	const messages: string[] = [];
	let DbClass: Awaited<ReturnType<typeof loadSqliteDatabase>>;
	try {
		DbClass = await loadSqliteDatabase();
	} catch (error) {
		return {
			repaired: false,
			mode: "none",
			messages,
			error: `SQLite driver unavailable: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	const recoveryPath = `${sqlitePath}.recovery-${Date.now()}`;
	const corruptBackupPath = `${sqlitePath}.corrupt-${Date.now()}`;

	let corrupt: SqliteDatabaseLike | undefined;
	let recovery: SqliteDatabaseLike | undefined;
	try {
		corrupt = new DbClass(sqlitePath);
		recovery = new DbClass(recoveryPath);

		const tables = corrupt
			.prepare(
				"SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL",
			)
			.all() as Array<{ name: string; sql: string }>;

		for (const { sql } of tables) {
			try {
				recovery.exec(sql);
			} catch (error) {
				messages.push(
					`Skipped schema statement: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		let rowsCopied = 0;
		for (const { name } of tables) {
			try {
				const rows = corrupt.prepare(`SELECT * FROM "${name}"`).all() as Record<
					string,
					unknown
				>[];
				if (rows.length === 0) continue;
				const columns = Object.keys(rows[0] ?? {});
				if (columns.length === 0) continue;
				const placeholders = columns.map(() => "?").join(", ");
				const insert = recovery.prepare(
					`INSERT INTO "${name}" (${columns
						.map((c) => `"${c}"`)
						.join(", ")}) VALUES (${placeholders})`,
				);
				for (const row of rows) {
					try {
						insert.run(...columns.map((c) => row[c] as unknown));
						rowsCopied++;
					} catch (error) {
						messages.push(
							`Row copy failed in ${name}: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}
			} catch (error) {
				messages.push(
					`Table ${name} could not be read: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
		messages.push(`Copied ${rowsCopied} row(s) to recovery database`);

		const check = runIntegrityCheckOnOpenDatabase(recovery, { mode: "quick" });
		if (check.status !== "ok") {
			return {
				repaired: false,
				mode: "dump-replay",
				messages: [...messages, ...check.messages],
				error: "Recovery database still fails integrity check",
			};
		}

		corrupt.close();
		corrupt = undefined;
		recovery.close();
		recovery = undefined;

		renameSync(sqlitePath, corruptBackupPath);
		renameSync(recoveryPath, sqlitePath);
		messages.push(`Original preserved at ${corruptBackupPath}`);

		return { repaired: true, mode: "dump-replay", messages };
	} catch (error) {
		try {
			rmSync(recoveryPath, { force: true });
		} catch {
			// Best-effort cleanup.
		}
		return {
			repaired: false,
			mode: "dump-replay",
			messages,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		corrupt?.close();
		recovery?.close();
	}
}
