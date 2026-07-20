import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive the integrity-check outcome (ok / corrupt / unavailable) so the
// open-time branches and their logging are observable.
type IntegrityResult = { status: string; messages?: string[]; error?: string };
const { integrityMock } = vi.hoisted(() => ({
	integrityMock: vi.fn((): IntegrityResult => ({ status: "ok", messages: [] })),
}));
vi.mock("../src/sqlite-integrity.js", () => ({
	runIntegrityCheckOnOpenDatabase: integrityMock,
}));

// Capture the integrity logger's error/warn so the corrupt/unavailable
// branches are observable (the logger is a module-load const).
const { errorSpy, warnSpy } = vi.hoisted(() => ({ errorSpy: vi.fn(), warnSpy: vi.fn() }));
vi.mock("../src/runtime-logger.js", async (orig) => ({
	...(await orig<typeof import("../src/runtime-logger.js")>()),
	createLogger: () => ({ error: errorSpy, warn: warnSpy, info: vi.fn(), debug: vi.fn() }),
}));

// Observe (and by default pass through) the filesystem guards.
const { existsSyncMock, rmSyncMock, mkdirSyncMock } = vi.hoisted(() => ({
	existsSyncMock: vi.fn(),
	rmSyncMock: vi.fn(),
	mkdirSyncMock: vi.fn(),
}));
vi.mock("node:fs", async (orig) => {
	const actual = await orig<typeof import("node:fs")>();
	existsSyncMock.mockImplementation(actual.existsSync);
	rmSyncMock.mockImplementation(actual.rmSync);
	mkdirSyncMock.mockImplementation(actual.mkdirSync);
	return { ...actual, existsSync: existsSyncMock, rmSync: rmSyncMock, mkdirSync: mkdirSyncMock };
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	createDefaultAstropressSqliteSeedToolkit,
	resolveAstropressSqliteSchemaPath,
} from "../src/sqlite-bootstrap";
import { loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";

const SqliteDatabase = await loadSqliteDatabase();

let workDir: string;

beforeEach(() => {
	workDir = mkdtempSync(path.join(tmpdir(), "ap-bootstrap-cov-"));
	integrityMock.mockReturnValue({ status: "ok", messages: [] });
	errorSpy.mockClear();
	warnSpy.mockClear();
	existsSyncMock.mockClear();
	rmSyncMock.mockClear();
	mkdirSyncMock.mockClear();
	vi.restoreAllMocks();
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
});

describe("resolveAstropressSqliteSchemaPath — primary/fallback", () => {
	it("returns the fallback path when the primary schema file is absent", () => {
		// Kills `if (existsSync(primaryPath)) return primaryPath` → `if (true)`:
		// with the primary missing, the fallback (one dir up) must be returned.
		existsSyncMock.mockReturnValueOnce(false);
		const resolved = resolveAstropressSqliteSchemaPath();
		expect(resolved.endsWith("sqlite-schema.sql")).toBe(true);
		expect(resolved).not.toMatch(/src[/\\]sqlite-schema\.sql$/);
	});
});

describe("openSeedDatabase — pragmas and integrity gate by dbPath", () => {
	it("runs WAL/synchronous pragmas and the integrity check only for a file path", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const prepareSpy = vi.spyOn(SqliteDatabase.prototype, "prepare");

		const fileDb = toolkit.openSeedDatabase(path.join(workDir, "file.sqlite"));
		const fileStatements = prepareSpy.mock.calls.map((c) => String(c[0]));
		fileDb.close();
		// File path: journal_mode + synchronous pragmas ran, integrity checked.
		expect(fileStatements.some((s) => s.includes("journal_mode"))).toBe(true);
		expect(fileStatements.some((s) => s.includes("synchronous"))).toBe(true);
		expect(integrityMock).toHaveBeenCalledWith(expect.anything(), { mode: "quick" });

		prepareSpy.mockClear();
		integrityMock.mockClear();
		const memDb = toolkit.openSeedDatabase(":memory:");
		const memStatements = prepareSpy.mock.calls.map((c) => String(c[0]));
		memDb.close();
		// :memory: path: the WAL pragmas and integrity check are skipped.
		expect(memStatements.some((s) => s.includes("journal_mode"))).toBe(false);
		expect(memStatements.some((s) => s.includes("synchronous"))).toBe(false);
		expect(integrityMock).not.toHaveBeenCalled();
		// foreign_keys always runs, for both.
		expect(memStatements.some((s) => s.includes("foreign_keys"))).toBe(true);
	});

	it("logs an error when the integrity check reports corruption", () => {
		integrityMock.mockReturnValue({ status: "corrupt", messages: ["bad page"] });
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		toolkit.openSeedDatabase(path.join(workDir, "corrupt.sqlite")).close();
		expect(errorSpy).toHaveBeenCalledWith(
			"SQLite integrity check failed on open",
			expect.objectContaining({ messages: ["bad page"] }),
		);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("logs a warning when the integrity check is unavailable", () => {
		integrityMock.mockReturnValue({ status: "unavailable", error: "no pragma" });
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		toolkit.openSeedDatabase(path.join(workDir, "unavail.sqlite")).close();
		expect(warnSpy).toHaveBeenCalledWith(
			"SQLite integrity check unavailable on open",
			expect.objectContaining({ error: "no pragma" }),
		);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("does not log for a healthy database", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		toolkit.openSeedDatabase(path.join(workDir, "ok.sqlite")).close();
		expect(errorSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
	});
});

describe("applyCommittedSchema — schema_migrations baseline row", () => {
	it("records the baseline-schema migration row", () => {
		// Kills the try-block removal at L107: without the INSERT the row is absent.
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = new SqliteDatabase(":memory:");
		toolkit.applyCommittedSchema(db);
		const row = db
			.prepare("SELECT name FROM schema_migrations WHERE name = 'baseline-schema'")
			.get();
		db.close();
		expect(row).toBeTruthy();
	});
});

describe("seedDatabase — filesystem guards keyed on dbPath / ownsConnection", () => {
	it("does not rm or mkdir for an in-memory database even with reset", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = new SqliteDatabase(":memory:");
		rmSyncMock.mockClear();
		mkdirSyncMock.mockClear();
		toolkit.seedDatabase({ db, dbPath: ":memory:", reset: true });
		db.close();
		// reset rmSync and the parent-dir mkdir are both guarded off for :memory:.
		expect(rmSyncMock).not.toHaveBeenCalledWith(":memory:", expect.anything());
		expect(mkdirSyncMock).not.toHaveBeenCalled();
	});

	it("does not mkdir the parent when the caller supplies the connection", () => {
		// ownsConnection is false, so the `ownsConnection && …` guard skips mkdir
		// even though dbPath is a real file path.
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = new SqliteDatabase(":memory:");
		mkdirSyncMock.mockClear();
		toolkit.seedDatabase({ db, dbPath: path.join(workDir, "sub", "given.sqlite") });
		db.close();
		expect(mkdirSyncMock).not.toHaveBeenCalled();
	});

	it("creates the parent dir with a recursive mkdir when it owns a file connection", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		mkdirSyncMock.mockClear();
		toolkit.seedDatabase({ dbPath: path.join(workDir, "made", "admin.sqlite") });
		expect(mkdirSyncMock).toHaveBeenCalledWith(path.join(workDir, "made"), { recursive: true });
	});
});

describe("seedDatabase — connection ownership close", () => {
	it("closes the connection it opened (ownsConnection=true)", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const closeSpy = vi.spyOn(SqliteDatabase.prototype, "close");
		toolkit.seedDatabase({ dbPath: path.join(workDir, "owned.sqlite") });
		expect(closeSpy).toHaveBeenCalledTimes(1);
	});

	it("does not close a caller-supplied connection (ownsConnection=false)", () => {
		const toolkit = createDefaultAstropressSqliteSeedToolkit();
		const db = new SqliteDatabase(":memory:");
		const closeSpy = vi.spyOn(SqliteDatabase.prototype, "close");
		toolkit.seedDatabase({ db, dbPath: ":memory:" });
		expect(closeSpy).not.toHaveBeenCalled();
		db.close();
	});
});
