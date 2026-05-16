import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkpointSqliteWal, loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";

// A fully controllable stand-in for the `bun:sqlite` Database class. Setting
// `globalThis.Bun` routes loadSqliteDatabase() through the Bun branch so tests
// can drive checkpointSqliteWal's database interactions deterministically.
const { fakeBunDatabase, bunDbState } = vi.hoisted(() => {
	const bunDbState = {
		// Value returned by `PRAGMA wal_checkpoint(TRUNCATE)`.get()
		pragmaRow: { log: 0, checkpointed: 1 } as { log: number; checkpointed: number } | null,
		throwOnConstruct: false,
		// When true, the `bun:sqlite` mock factory throws — making the dynamic
		// import (and therefore loadSqliteDatabase) reject.
		importThrows: false,
		closeCalls: 0,
	};
	class FakeBunDatabase {
		constructor(public readonly filename: string) {
			if (bunDbState.throwOnConstruct) {
				throw new Error(`cannot open ${filename}`);
			}
		}
		prepare(_sql: string) {
			return {
				get: () => bunDbState.pragmaRow,
				run: () => ({}),
				all: () => [],
			};
		}
		exec() {}
		close() {
			bunDbState.closeCalls += 1;
		}
	}
	return { fakeBunDatabase: FakeBunDatabase, bunDbState };
});

vi.mock("bun:sqlite", () => ({
	// A getter so each access can be toggled to throw — accessing `m.Database`
	// inside loadSqliteDatabase then makes that function's promise reject.
	get Database() {
		if (bunDbState.importThrows) {
			throw new Error("bun:sqlite Database unavailable");
		}
		return fakeBunDatabase;
	},
}));

let testRoot: string;

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-helpers-test-"));
	bunDbState.pragmaRow = { log: 0, checkpointed: 1 };
	bunDbState.throwOnConstruct = false;
	bunDbState.importThrows = false;
	bunDbState.closeCalls = 0;
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
	delete (globalThis as { Bun?: unknown }).Bun;
	vi.resetModules();
});

describe("loadSqliteDatabase", () => {
	it("returns a constructor that can open an in-memory database", async () => {
		const DbClass = await loadSqliteDatabase();
		const db = new DbClass(":memory:");
		db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
		db.prepare("INSERT INTO t VALUES (1)").run();
		const row = db.prepare("SELECT id FROM t").get() as { id: number };
		expect(row.id).toBe(1);
		db.close();
	});

	it("returns the node:sqlite DatabaseSync constructor when not running under Bun", async () => {
		// Pins the node branch: a non-Bun runtime must resolve to node:sqlite's
		// DatabaseSync, never the bun:sqlite stub.
		expect("Bun" in globalThis).toBe(false);
		const DbClass = await loadSqliteDatabase();
		expect(DbClass).not.toBe(fakeBunDatabase);
		expect(DbClass.name).toBe("DatabaseSync");
	});

	it("returns the bun:sqlite Database constructor when running under Bun", async () => {
		// Pins the `"Bun" in globalThis` guard and the `bun:sqlite` import: with
		// Bun present, loadSqliteDatabase must resolve to bun:sqlite's Database.
		(globalThis as { Bun?: unknown }).Bun = {};
		const DbClass = await loadSqliteDatabase();
		expect(DbClass).toBe(fakeBunDatabase);
	});
});

describe("checkpointSqliteWal", () => {
	it("returns true and emits no warning for a real WAL-mode SQLite file", async () => {
		const DbClass = await loadSqliteDatabase();
		const dbPath = join(testRoot, "real.sqlite");

		// Create a real SQLite DB in WAL mode with some data
		const db = new DbClass(dbPath);
		db.prepare("PRAGMA journal_mode = WAL").get();
		db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)");
		db.prepare("INSERT INTO items VALUES (1, 'hello')").run();
		db.close();

		const warnings: string[] = [];
		const result = await checkpointSqliteWal(dbPath, (msg) => warnings.push(msg));

		expect(result).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it("returns false and warns when the file is not a valid SQLite database", async () => {
		const badPath = join(testRoot, "bad.sqlite");
		writeFileSync(badPath, "this is not sqlite", "utf8");

		const warnings: string[] = [];
		const result = await checkpointSqliteWal(badPath, (msg) => warnings.push(msg));

		expect(result).toBe(false);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("bad.sqlite");
	});

	it("returns false (not a rejection) when the driver constructor itself throws on an unopenable path", async () => {
		// Path under a non-existent directory makes node:sqlite throw inside
		// `new DatabaseSync(path)` synchronously, leaving `db` undefined inside
		// the checkpoint helper. The finally block must still resolve cleanly —
		// `db?.close()`'s optional chain is load-bearing here.
		const unopenablePath = join(testRoot, "no-such-dir", "db.sqlite");

		const warnings: string[] = [];
		await expect(checkpointSqliteWal(unopenablePath, (msg) => warnings.push(msg))).resolves.toBe(
			false,
		);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("WAL checkpoint failed");
	});

	it("warns and returns false when loadSqliteDatabase rejects", async () => {
		// Drives the first catch block: with Bun present but `bun:sqlite`'s
		// Database export unresolvable, loadSqliteDatabase rejects and
		// checkpointSqliteWal must emit the "checkpoint skipped" warning.
		bunDbState.importThrows = true;
		(globalThis as { Bun?: unknown }).Bun = {};

		const warnings: string[] = [];
		const result = await checkpointSqliteWal("/tmp/skipme.sqlite", (msg) => warnings.push(msg));

		expect(result).toBe(false);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("SQLite WAL checkpoint skipped for /tmp/skipme.sqlite");
	});

	it("returns false without warning when the WAL is not fully flushed (log > 0)", async () => {
		// Pins `row.log === 0`: a non-zero log page count means the checkpoint
		// did not fully truncate, so the helper must report false — and must NOT
		// warn (no error occurred, the WAL simply wasn't fully flushed).
		bunDbState.pragmaRow = { log: 3, checkpointed: 0 };
		(globalThis as { Bun?: unknown }).Bun = {};

		const warnings: string[] = [];
		const result = await checkpointSqliteWal("/tmp/partial.sqlite", (msg) => warnings.push(msg));

		expect(result).toBe(false);
		expect(warnings).toHaveLength(0);
	});

	it("returns false without warning when the checkpoint pragma yields no row", async () => {
		// Pins `row != null`: a null pragma result must short-circuit to false
		// without dereferencing `row.log` (which would throw and warn).
		bunDbState.pragmaRow = null;
		(globalThis as { Bun?: unknown }).Bun = {};

		const warnings: string[] = [];
		const result = await checkpointSqliteWal("/tmp/norow.sqlite", (msg) => warnings.push(msg));

		expect(result).toBe(false);
		expect(warnings).toHaveLength(0);
	});

	it("returns true when the WAL is fully flushed (log === 0)", async () => {
		bunDbState.pragmaRow = { log: 0, checkpointed: 5 };
		(globalThis as { Bun?: unknown }).Bun = {};

		const warnings: string[] = [];
		const result = await checkpointSqliteWal("/tmp/clean.sqlite", (msg) => warnings.push(msg));

		expect(result).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it("closes the database in the finally block after a successful checkpoint", async () => {
		bunDbState.pragmaRow = { log: 0, checkpointed: 1 };
		(globalThis as { Bun?: unknown }).Bun = {};

		await checkpointSqliteWal("/tmp/closeme.sqlite", () => {});

		expect(bunDbState.closeCalls).toBe(1);
	});
});
