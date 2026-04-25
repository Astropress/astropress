import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";
import {
	attemptRepair,
	runIntegrityCheck,
	runIntegrityCheckOnOpenDatabase,
} from "../src/sqlite-integrity";

let testRoot: string;

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-integrity-"));
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
});

async function seedHealthyDb(dbPath: string) {
	const DbClass = await loadSqliteDatabase();
	const db = new DbClass(dbPath);
	db.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)");
	db.prepare("INSERT INTO widgets (name) VALUES (?)").run("alpha");
	db.prepare("INSERT INTO widgets (name) VALUES (?)").run("beta");
	db.close();
}

/** Corrupt the data region of a sqlite file while leaving the header intact. */
function corruptDbFile(dbPath: string) {
	const buf = readFileSync(dbPath);
	for (let i = 4096; i < buf.length; i++) buf[i] = 0xff;
	writeFileSync(dbPath, buf);
}

describe("runIntegrityCheck", () => {
	it("reports ok on a clean database with messages=['ok'] and mode='quick'", async () => {
		const dbPath = join(testRoot, "healthy.sqlite");
		await seedHealthyDb(dbPath);
		const result = await runIntegrityCheck(dbPath, { mode: "quick" });
		expect(result.status).toBe("ok");
		expect(result.mode).toBe("quick");
		expect(result.messages).toEqual(["ok"]);
		expect(result.error).toBeUndefined();
	});

	it("defaults mode to 'quick' when no options are given", async () => {
		const dbPath = join(testRoot, "default-mode.sqlite");
		await seedHealthyDb(dbPath);
		const result = await runIntegrityCheck(dbPath);
		expect(result.mode).toBe("quick");
		expect(result.status).toBe("ok");
	});

	it("supports the slower 'full' mode (PRAGMA integrity_check) on a clean DB", async () => {
		const dbPath = join(testRoot, "full.sqlite");
		await seedHealthyDb(dbPath);
		const result = await runIntegrityCheck(dbPath, { mode: "full" });
		expect(result.status).toBe("ok");
		expect(result.mode).toBe("full");
		expect(result.messages).toEqual(["ok"]);
	});

	it("reports unavailable for a non-sqlite file with a populated error string", async () => {
		const bogus = join(testRoot, "not-a-db.sqlite");
		writeFileSync(bogus, "this is definitely not a sqlite file");
		const result = await runIntegrityCheck(bogus, { mode: "quick" });
		expect(result.status).toBe("unavailable");
		expect(result.mode).toBe("quick");
		expect(result.messages).toEqual([]);
		expect(result.error).toBeTruthy();
	});

	it("reports a non-ok status when quick_check trips on a corrupt body region", async () => {
		const dbPath = join(testRoot, "corrupt.sqlite");
		await seedHealthyDb(dbPath);
		corruptDbFile(dbPath);
		const result = await runIntegrityCheck(dbPath, { mode: "quick" });
		expect(result.status).not.toBe("ok");
		// Either corrupt (driver opens but check fails) or unavailable (driver
		// errors on first read). Both are acceptable — what matters is we don't
		// pretend the DB is healthy.
		expect(["corrupt", "unavailable"]).toContain(result.status);
	});

	it("returns unavailable with the driver error when loadDb rejects", async () => {
		const result = await runIntegrityCheck("/nonexistent.sqlite", {
			loadDb: () => Promise.reject(new Error("driver-load-fail")),
		});
		expect(result.status).toBe("unavailable");
		expect(result.mode).toBe("quick");
		expect(result.messages).toEqual([]);
		expect(result.messages.length).toBe(0);
		expect(result.error).toBe("SQLite driver unavailable: driver-load-fail");
	});

	it("stringifies non-Error rejections from loadDb", async () => {
		const result = await runIntegrityCheck("/nonexistent.sqlite", {
			loadDb: () => Promise.reject("plain-string-failure"),
		});
		expect(result.status).toBe("unavailable");
		expect(result.error).toBe(
			"SQLite driver unavailable: plain-string-failure",
		);
	});

	it("returns unavailable when the constructor throws on open", async () => {
		const fakeCtor = function FakeDb() {
			throw new Error("open-fail");
		} as unknown as Parameters<
			NonNullable<Parameters<typeof runIntegrityCheck>[1]>["loadDb"]
		> extends never
			? never
			: Awaited<
					ReturnType<
						NonNullable<Parameters<typeof runIntegrityCheck>[1]>["loadDb"]
					>
				>;
		const result = await runIntegrityCheck("/some/path.sqlite", {
			loadDb: async () => fakeCtor,
		});
		expect(result.status).toBe("unavailable");
		expect(result.error).toContain(
			"Failed to open database at /some/path.sqlite",
		);
		expect(result.error).toContain("open-fail");
	});

	it("stringifies non-Error throws from the constructor", async () => {
		const fakeCtor = function FakeDb() {
			throw "ctor-string-failure";
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof runIntegrityCheck>[1]>["loadDb"]>
		>;
		const result = await runIntegrityCheck("/some/path.sqlite", {
			loadDb: async () => fakeCtor,
		});
		expect(result.status).toBe("unavailable");
		expect(result.error).toContain("ctor-string-failure");
	});
});

describe("runIntegrityCheckOnOpenDatabase", () => {
	it("returns ok / mode=quick / messages=['ok'] for a healthy in-memory DB", async () => {
		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(":memory:");
		db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
		const result = runIntegrityCheckOnOpenDatabase(db);
		expect(result.status).toBe("ok");
		expect(result.mode).toBe("quick");
		expect(result.messages).toEqual(["ok"]);
		db.close();
	});

	it("respects an explicit mode option", async () => {
		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(":memory:");
		db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
		const result = runIntegrityCheckOnOpenDatabase(db, { mode: "full" });
		expect(result.mode).toBe("full");
		db.close();
	});

	it("issues PRAGMA quick_check for mode='quick'", () => {
		const captured: string[] = [];
		const fakeDb = {
			exec: () => undefined,
			prepare: (sql: string) => {
				captured.push(sql);
				return {
					run: () => ({}),
					get: () => null,
					all: () => [{ quick_check: "ok" }],
				};
			},
			close: () => undefined,
		};
		runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
			{ mode: "quick" },
		);
		expect(captured).toEqual(["PRAGMA quick_check"]);
	});

	it("issues PRAGMA integrity_check for mode='full'", () => {
		const captured: string[] = [];
		const fakeDb = {
			exec: () => undefined,
			prepare: (sql: string) => {
				captured.push(sql);
				return {
					run: () => ({}),
					get: () => null,
					all: () => [{ integrity_check: "ok" }],
				};
			},
			close: () => undefined,
		};
		runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
			{ mode: "full" },
		);
		expect(captured).toEqual(["PRAGMA integrity_check"]);
	});

	it("returns unavailable with the error message when prepare throws", () => {
		const fakeDb = {
			exec: () => undefined,
			prepare: () => {
				throw new Error("boom");
			},
			close: () => undefined,
		};
		const result = runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
		);
		expect(result.status).toBe("unavailable");
		expect(result.messages).toEqual([]);
		expect(result.error).toBe("boom");
	});

	it("stringifies non-Error throws into the error field", () => {
		const fakeDb = {
			exec: () => undefined,
			prepare: () => {
				throw "string-failure";
			},
			close: () => undefined,
		};
		const result = runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
		);
		expect(result.status).toBe("unavailable");
		expect(result.error).toBe("string-failure");
	});

	it("treats a non-string pragma row entry by stringifying it", () => {
		// PRAGMA quick_check normally returns a single { quick_check: "ok" } row.
		// Some drivers may surface non-string sentinels in error rows; assert we
		// don't lose the data.
		const fakeDb = {
			exec: () => undefined,
			prepare: () => ({
				run: () => ({}),
				get: () => null,
				all: () => [{ integrity_check: 1 }],
			}),
			close: () => undefined,
		};
		const result = runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
		);
		// "1" is not "ok" → corrupt. Messages should carry the stringified value.
		expect(result.status).toBe("corrupt");
		expect(result.messages).toEqual(["1"]);
	});

	it("treats multi-row pragma output as corrupt (real corruption produces > 1 message)", () => {
		const fakeDb = {
			exec: () => undefined,
			prepare: () => ({
				run: () => ({}),
				get: () => null,
				all: () => [{ quick_check: "ok" }, { quick_check: "ok" }],
			}),
			close: () => undefined,
		};
		const result = runIntegrityCheckOnOpenDatabase(
			fakeDb as unknown as Parameters<
				typeof runIntegrityCheckOnOpenDatabase
			>[0],
		);
		expect(result.status).toBe("corrupt");
		expect(result.messages).toEqual(["ok", "ok"]);
	});
});

describe("attemptRepair", () => {
	it("repairs a healthy database (round-trip schema + rows) and reports success", async () => {
		const dbPath = join(testRoot, "recover.sqlite");
		await seedHealthyDb(dbPath);

		const result = await attemptRepair(dbPath);
		expect(result.repaired).toBe(true);
		expect(result.mode).toBe("dump-replay");
		expect(result.error).toBeUndefined();

		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(dbPath);
		const rows = db
			.prepare("SELECT name FROM widgets ORDER BY id")
			.all() as Array<{ name: string }>;
		expect(rows.map((r) => r.name)).toEqual(["alpha", "beta"]);
		db.close();
	});

	it("preserves the original at <db>.corrupt-<ts> after a successful repair", async () => {
		const dbPath = join(testRoot, "preserve.sqlite");
		await seedHealthyDb(dbPath);
		const result = await attemptRepair(dbPath);
		expect(result.repaired).toBe(true);
		const preservedMessage = result.messages.find((m) =>
			m.startsWith("Original preserved at "),
		);
		expect(preservedMessage).toBeDefined();
		const preservedPath = (preservedMessage ?? "").replace(
			"Original preserved at ",
			"",
		);
		expect(existsSync(preservedPath)).toBe(true);
	});

	it("includes a 'Copied N row(s)' message reflecting the actual count", async () => {
		const dbPath = join(testRoot, "row-count.sqlite");
		await seedHealthyDb(dbPath);
		const result = await attemptRepair(dbPath);
		expect(result.messages).toContain("Copied 2 row(s) to recovery database");
	});

	it("reports failure with mode='dump-replay' when source is not a sqlite database", async () => {
		const bogus = join(testRoot, "garbage.sqlite");
		writeFileSync(bogus, "not a database");
		const result = await attemptRepair(bogus);
		expect(result.repaired).toBe(false);
		expect(result.mode).toBe("dump-replay");
		expect(result.error).toBeTruthy();
	});

	it("does not leave a recovery file behind when repair fails", async () => {
		const bogus = join(testRoot, "leftover.sqlite");
		writeFileSync(bogus, "not a database");
		await attemptRepair(bogus);
		const fs = await import("node:fs/promises");
		const entries = await fs.readdir(testRoot);
		expect(entries.filter((n) => n.includes(".recovery-"))).toEqual([]);
	});

	it("returns repaired=false with mode='none' when loadDb rejects", async () => {
		const result = await attemptRepair("/some/path.sqlite", {
			loadDb: () => Promise.reject(new Error("driver-load-fail")),
		});
		expect(result.repaired).toBe(false);
		expect(result.mode).toBe("none");
		expect(result.messages).toEqual([]);
		expect(result.error).toBe("SQLite driver unavailable: driver-load-fail");
	});

	it("logs 'Skipped schema statement' when recovery.exec throws on a CREATE TABLE", async () => {
		// Build a fake constructor where the first instance (corrupt) yields a
		// table list and the second (recovery) throws on exec.
		let instance = 0;
		const fakeCtor = function FakeDb() {
			const me = instance++;
			if (me === 0) {
				return {
					exec: () => undefined,
					prepare: (_sql: string) => ({
						run: () => ({}),
						get: () => null,
						all: () => [
							{ name: "broken_table", sql: "CREATE TABLE broken_table()" },
						],
					}),
					close: () => undefined,
				};
			}
			return {
				exec: (_sql: string) => {
					throw new Error("schema-broken");
				},
				prepare: (_sql: string) => ({
					run: () => ({}),
					get: () => null,
					all: () => [{ quick_check: "ok" }],
				}),
				close: () => undefined,
			};
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof attemptRepair>[1]>["loadDb"]>
		>;
		const dbPath = join(testRoot, "schema-fail.sqlite");
		const result = await attemptRepair(dbPath, {
			loadDb: async () => fakeCtor,
		});
		expect(
			result.messages.some((m) =>
				m.startsWith("Skipped schema statement: schema-broken"),
			),
		).toBe(true);
	});

	it("logs 'Row copy failed' when an INSERT throws on the recovery DB", async () => {
		let instance = 0;
		const fakeCtor = function FakeDb() {
			const me = instance++;
			if (me === 0) {
				return {
					exec: () => undefined,
					prepare: (sql: string) => {
						if (sql.startsWith("SELECT name, sql FROM sqlite_master")) {
							return {
								run: () => ({}),
								get: () => null,
								all: () => [{ name: "t", sql: "CREATE TABLE t(id INTEGER)" }],
							};
						}
						// SELECT * FROM "t"
						return {
							run: () => ({}),
							get: () => null,
							all: () => [{ id: 1 }],
						};
					},
					close: () => undefined,
				};
			}
			return {
				exec: () => undefined,
				prepare: (sql: string) => {
					if (sql.startsWith("INSERT INTO")) {
						return {
							run: () => {
								throw new Error("insert-fail");
							},
							get: () => null,
							all: () => [],
						};
					}
					return {
						run: () => ({}),
						get: () => null,
						all: () => [{ quick_check: "ok" }],
					};
				},
				close: () => undefined,
			};
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof attemptRepair>[1]>["loadDb"]>
		>;
		const result = await attemptRepair(join(testRoot, "row-fail.sqlite"), {
			loadDb: async () => fakeCtor,
		});
		expect(
			result.messages.some((m) =>
				m.startsWith("Row copy failed in t: insert-fail"),
			),
		).toBe(true);
	});

	it("logs 'Table T could not be read' when SELECT * throws", async () => {
		let instance = 0;
		const fakeCtor = function FakeDb() {
			const me = instance++;
			if (me === 0) {
				return {
					exec: () => undefined,
					prepare: (sql: string) => {
						if (sql.startsWith("SELECT name, sql FROM sqlite_master")) {
							return {
								run: () => ({}),
								get: () => null,
								all: () => [{ name: "t", sql: "CREATE TABLE t(id INTEGER)" }],
							};
						}
						// SELECT * FROM "t" → throw
						return {
							run: () => ({}),
							get: () => null,
							all: () => {
								throw new Error("read-fail");
							},
						};
					},
					close: () => undefined,
				};
			}
			return {
				exec: () => undefined,
				prepare: () => ({
					run: () => ({}),
					get: () => null,
					all: () => [{ quick_check: "ok" }],
				}),
				close: () => undefined,
			};
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof attemptRepair>[1]>["loadDb"]>
		>;
		const result = await attemptRepair(join(testRoot, "table-fail.sqlite"), {
			loadDb: async () => fakeCtor,
		});
		expect(
			result.messages.some((m) =>
				m.startsWith("Table t could not be read: read-fail"),
			),
		).toBe(true);
	});

	it("skips empty tables (rows.length===0) without inserting", async () => {
		let instance = 0;
		let insertCalled = false;
		const fakeCtor = function FakeDb() {
			const me = instance++;
			if (me === 0) {
				return {
					exec: () => undefined,
					prepare: (sql: string) => {
						if (sql.startsWith("SELECT name, sql FROM sqlite_master")) {
							return {
								run: () => ({}),
								get: () => null,
								all: () => [
									{ name: "empty_t", sql: "CREATE TABLE empty_t(id INTEGER)" },
								],
							};
						}
						return {
							run: () => ({}),
							get: () => null,
							all: () => [],
						};
					},
					close: () => undefined,
				};
			}
			return {
				exec: () => undefined,
				prepare: (sql: string) => {
					if (sql.startsWith("INSERT")) insertCalled = true;
					return {
						run: () => ({}),
						get: () => null,
						all: () => [{ quick_check: "ok" }],
					};
				},
				close: () => undefined,
			};
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof attemptRepair>[1]>["loadDb"]>
		>;
		const result = await attemptRepair(join(testRoot, "empty.sqlite"), {
			loadDb: async () => fakeCtor,
		});
		expect(insertCalled).toBe(false);
		expect(result.messages).toContain("Copied 0 row(s) to recovery database");
		// No "could not be read" message — the empty table must be handled by the
		// explicit length check, not fall through to the outer catch.
		expect(
			result.messages.some((m) =>
				m.startsWith("Table empty_t could not be read"),
			),
		).toBe(false);
	});

	it("returns failure with messages when recovery DB still fails integrity", async () => {
		// corrupt yields a table; recovery exec succeeds; quick_check returns non-ok.
		let instance = 0;
		const fakeCtor = function FakeDb() {
			const me = instance++;
			if (me === 0) {
				return {
					exec: () => undefined,
					prepare: (_sql: string) => ({
						run: () => ({}),
						get: () => null,
						all: () => [{ name: "t", sql: "CREATE TABLE t(id INTEGER)" }],
					}),
					close: () => undefined,
				};
			}
			return {
				exec: (_sql: string) => undefined,
				prepare: (_sql: string) => ({
					run: () => ({}),
					get: () => null,
					all: () => [{ quick_check: "still broken" }],
				}),
				close: () => undefined,
			};
		} as unknown as Awaited<
			ReturnType<NonNullable<Parameters<typeof attemptRepair>[1]>["loadDb"]>
		>;
		const dbPath = join(testRoot, "still-broken.sqlite");
		const result = await attemptRepair(dbPath, {
			loadDb: async () => fakeCtor,
		});
		expect(result.repaired).toBe(false);
		expect(result.mode).toBe("dump-replay");
		expect(result.error).toBe("Recovery database still fails integrity check");
		expect(result.messages).toContain("still broken");
	});
});
