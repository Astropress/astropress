import { constants, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { copyFile as copyFilePromise } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAstropressGitSyncAdapter } from "../src/sync/git";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRunIntegrityCheck, mockCheckpointWal, realCopyFile } = await vi.hoisted(async () => {
	const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
	return {
		mockRunIntegrityCheck: vi.fn(),
		mockCheckpointWal: vi.fn(),
		realCopyFile: actual.copyFile,
	};
});

// Partial mock: keep all of node:fs/promises real except copyFile, which is a
// spy that calls through by default so reflink behaviour can be driven per-test.
vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, copyFile: vi.fn(actual.copyFile) };
});

vi.mock("../src/sqlite-integrity", () => ({ runIntegrityCheck: mockRunIntegrityCheck }));
vi.mock("../src/sqlite-integrity.js", () => ({ runIntegrityCheck: mockRunIntegrityCheck }));
vi.mock("../src/sqlite-bootstrap-helpers", () => ({ checkpointSqliteWal: mockCheckpointWal }));
vi.mock("../src/sqlite-bootstrap-helpers.js", () => ({ checkpointSqliteWal: mockCheckpointWal }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testRoot: string;

function makeDir(name: string): string {
	const dir = join(testRoot, name);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function writeFiles(dir: string, files: Record<string, string>) {
	for (const [rel, content] of Object.entries(files)) {
		const fullPath = join(dir, rel);
		mkdirSync(join(dir, rel, ".."), { recursive: true });
		writeFileSync(fullPath, content, "utf8");
	}
}

/** Makes every reflink (COPYFILE_FICLONE) attempt fail with the given errno code. */
function failReflinkWith(code: string) {
	vi.mocked(copyFilePromise).mockImplementation((async (
		src: string,
		dest: string,
		mode?: number,
	) => {
		if (mode === constants.COPYFILE_FICLONE) {
			const err = new Error(`reflink rejected: ${code}`) as NodeJS.ErrnoException;
			err.code = code;
			throw err;
		}
		return realCopyFile(src, dest);
	}) as typeof copyFilePromise);
}

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-git-sync-test-"));
	mockRunIntegrityCheck.mockReset();
	mockRunIntegrityCheck.mockResolvedValue({ status: "ok", mode: "quick", messages: [] });
	mockCheckpointWal.mockReset();
	mockCheckpointWal.mockResolvedValue(true);
	// Restore copyFile's call-through behaviour for the FS-backed tests.
	vi.mocked(copyFilePromise).mockReset();
	vi.mocked(copyFilePromise).mockImplementation(realCopyFile);
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// exportSnapshot
// ---------------------------------------------------------------------------

describe("createAstropressGitSyncAdapter — exportSnapshot", () => {
	it("copies included entries to target dir and returns file count", async () => {
		const projectDir = makeDir("project-export");
		writeFiles(projectDir, {
			"package.json": '{"name":"test"}',
			"src/index.ts": "export {}",
			"src/utils.ts": "export const x = 1;",
		});

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json", "src"],
		});

		const targetDir = makeDir("snapshot-export");
		const result = await adapter.exportSnapshot(targetDir);

		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
		expect(existsSync(join(targetDir, "src", "index.ts"))).toBe(true);
		expect(existsSync(join(targetDir, "src", "utils.ts"))).toBe(true);
		expect(result.fileCount).toBe(3); // package.json + 2 src files
		expect(result.targetDir).toContain("snapshot-export");
	});

	it("skips missing entries without error", async () => {
		const projectDir = makeDir("project-missing");
		writeFiles(projectDir, { "package.json": "{}" });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json", "does-not-exist"],
		});

		const targetDir = makeDir("snapshot-missing");
		const result = await adapter.exportSnapshot(targetDir);

		expect(result.fileCount).toBe(1);
		expect(existsSync(join(targetDir, "does-not-exist"))).toBe(false);
	});

	it("overwrites an existing snapshot (idempotent)", async () => {
		const projectDir = makeDir("project-idem");
		writeFiles(projectDir, { "package.json": '{"v":1}' });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json"],
		});
		const targetDir = makeDir("snapshot-idem");

		await adapter.exportSnapshot(targetDir);
		// Second export should not throw
		await expect(adapter.exportSnapshot(targetDir)).resolves.toBeDefined();
		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
	});

	it("recreates a target directory that does not yet exist", async () => {
		// Pins `rm(outputDir, { recursive: true, force: true })`: without
		// `force: true` the rm of a non-existent path throws ENOENT; without
		// `recursive: true` the later overwrite of a populated dir throws.
		const projectDir = makeDir("project-fresh-target");
		writeFiles(projectDir, { "package.json": "{}" });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json"],
		});
		const targetDir = join(testRoot, "never-created-target");
		expect(existsSync(targetDir)).toBe(false);

		const result = await adapter.exportSnapshot(targetDir);
		expect(result.fileCount).toBe(1);
		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
	});

	it("uses default include entries when not specified", async () => {
		const projectDir = makeDir("project-default");
		writeFiles(projectDir, {
			"package.json": "{}",
			"astro.config.mjs": "export default {}",
		});

		const adapter = createAstropressGitSyncAdapter({ projectDir });
		const targetDir = makeDir("snapshot-default");
		const result = await adapter.exportSnapshot(targetDir);

		// Only entries that exist in projectDir should be copied
		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
		expect(existsSync(join(targetDir, "astro.config.mjs"))).toBe(true);
		expect(result.fileCount).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// importSnapshot
// ---------------------------------------------------------------------------

describe("createAstropressGitSyncAdapter — importSnapshot", () => {
	it("copies snapshot entries back to project dir", async () => {
		const projectDir = makeDir("project-import");
		const snapshotDir = makeDir("snapshot-for-import");

		writeFiles(snapshotDir, {
			"package.json": '{"restored":true}',
			"src/index.ts": "// restored",
		});

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json", "src"],
		});

		const result = await adapter.importSnapshot(snapshotDir);

		expect(existsSync(join(projectDir, "package.json"))).toBe(true);
		expect(existsSync(join(projectDir, "src", "index.ts"))).toBe(true);
		expect(result.fileCount).toBe(2);
		expect(result.sourceDir).toContain("snapshot-for-import");
	});

	it("replaces existing files in project dir", async () => {
		const projectDir = makeDir("project-replace");
		writeFiles(projectDir, { "package.json": '{"old":true}' });

		const snapshotDir = makeDir("snapshot-replace");
		writeFiles(snapshotDir, { "package.json": '{"new":true}' });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json"],
		});

		await adapter.importSnapshot(snapshotDir);

		const content = require("node:fs").readFileSync(join(projectDir, "package.json"), "utf8");
		expect(JSON.parse(content).new).toBe(true);
	});

	it("skips missing entries in snapshot without error", async () => {
		const projectDir = makeDir("project-skip");
		const snapshotDir = makeDir("snapshot-skip");
		writeFiles(snapshotDir, { "package.json": "{}" });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json", "missing-entry"],
		});

		const result = await adapter.importSnapshot(snapshotDir);
		expect(result.fileCount).toBe(1);
	});

	it("removes entries that exist in project but are absent from snapshot", async () => {
		const projectDir = makeDir("project-extra");
		writeFiles(projectDir, {
			"src/stale.ts": "// stale",
			"src/keep.ts": "// keep",
		});

		const snapshotDir = makeDir("snapshot-extra");
		writeFiles(snapshotDir, { "src/keep.ts": "// keep" });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["src"],
		});

		await adapter.importSnapshot(snapshotDir);

		expect(existsSync(join(projectDir, "src", "keep.ts"))).toBe(true);
		expect(existsSync(join(projectDir, "src", "stale.ts"))).toBe(false);
	});

	it("returns sourceDir in the result", async () => {
		const projectDir = makeDir("project-result");
		const snapshotDir = makeDir("snapshot-result");
		writeFiles(snapshotDir, { "package.json": "{}" });

		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["package.json"],
		});

		const result = await adapter.importSnapshot(snapshotDir);
		expect(result.sourceDir).toContain("snapshot-result");
		expect(result.fileCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Reflink fallback (copyFileWithReflink)
// ---------------------------------------------------------------------------

describe("createAstropressGitSyncAdapter — reflink fallback", () => {
	function makeLoggingAdapter(name: string, include: string[]) {
		const projectDir = makeDir(`${name}-project`);
		const infos: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include,
			logger: { info: (m) => infos.push(m), warn: () => {} },
		});
		return { projectDir, adapter, infos };
	}

	it("logs copy-on-write when reflink copies succeed", async () => {
		// Force the FICLONE copy to succeed (via plain copy) so usedReflink stays
		// true — pins `return true` after a successful reflink copy.
		vi.mocked(copyFilePromise).mockImplementation((async (src: string, dest: string) =>
			realCopyFile(src, dest)) as typeof copyFilePromise);

		const { projectDir, adapter, infos } = makeLoggingAdapter("reflink-ok", ["package.json"]);
		writeFiles(projectDir, { "package.json": "{}" });

		await adapter.exportSnapshot(makeDir("reflink-ok-target"));
		expect(infos).toEqual(["Snapshot exported using copy-on-write (reflink): 1 file(s)"]);
	});

	it("falls back to a plain copy and logs standard copy when reflink is unsupported", async () => {
		// ENOTSUP from the FICLONE attempt must be caught, retried as a plain
		// copy, and reported as a standard (non-reflink) copy.
		failReflinkWith("ENOTSUP");

		const { projectDir, adapter, infos } = makeLoggingAdapter("reflink-enotsup", ["package.json"]);
		writeFiles(projectDir, { "package.json": '{"a":1}' });

		const targetDir = makeDir("reflink-enotsup-target");
		const result = await adapter.exportSnapshot(targetDir);

		expect(result.fileCount).toBe(1);
		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
		expect(infos).toEqual(["Snapshot exported using standard copy: 1 file(s)"]);
	});

	it("also falls back for EOPNOTSUPP and EXDEV reflink errors", async () => {
		for (const code of ["EOPNOTSUPP", "EXDEV"]) {
			failReflinkWith(code);
			const { projectDir, adapter, infos } = makeLoggingAdapter(`reflink-${code}`, [
				"package.json",
			]);
			writeFiles(projectDir, { "package.json": "{}" });
			const targetDir = makeDir(`reflink-${code}-target`);
			const result = await adapter.exportSnapshot(targetDir);
			expect(result.fileCount).toBe(1);
			expect(infos[0]).toContain("standard copy");
		}
	});

	it("rethrows reflink errors that are not a known unsupported-filesystem code", async () => {
		// EACCES is not in the fallback allowlist — it must propagate.
		failReflinkWith("EACCES");

		const { projectDir, adapter } = makeLoggingAdapter("reflink-eacces", ["package.json"]);
		writeFiles(projectDir, { "package.json": "{}" });

		await expect(adapter.exportSnapshot(makeDir("reflink-eacces-target"))).rejects.toThrow(
			/reflink rejected: EACCES/,
		);
	});

	it("logs copy-on-write for a directory only when every nested file used reflink", async () => {
		const { projectDir, adapter, infos } = makeLoggingAdapter("reflink-dir-ok", ["src"]);
		writeFiles(projectDir, {
			"src/a.ts": "// a",
			"src/nested/b.ts": "// b",
		});
		await adapter.exportSnapshot(makeDir("reflink-dir-ok-target"));
		expect(infos).toEqual(["Snapshot exported using copy-on-write (reflink): 2 file(s)"]);
	});

	it("logs standard copy for a directory when no nested file used reflink", async () => {
		failReflinkWith("ENOTSUP");
		const { projectDir, adapter, infos } = makeLoggingAdapter("reflink-dir-std", ["src"]);
		writeFiles(projectDir, {
			"src/a.ts": "// a",
			"src/nested/b.ts": "// b",
		});
		await adapter.exportSnapshot(makeDir("reflink-dir-std-target"));
		expect(infos).toEqual(["Snapshot exported using standard copy: 2 file(s)"]);
	});

	it("reports a standard copy for an empty included directory", async () => {
		// An empty directory runs no copy at all — usedReflink/anyReflink must
		// stay false (their initialisers), so the log says standard copy.
		const projectDir = makeDir("reflink-empty-project");
		mkdirSync(join(projectDir, "src"), { recursive: true });
		const infos: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["src"],
			logger: { info: (m) => infos.push(m), warn: () => {} },
		});
		await adapter.exportSnapshot(makeDir("reflink-empty-target"));
		expect(infos).toEqual(["Snapshot exported using standard copy: 0 file(s)"]);
	});

	it("logs the import copy method", async () => {
		failReflinkWith("ENOTSUP");
		const projectDir = makeDir("reflink-import-project");
		const snapshotDir = makeDir("reflink-import-snapshot");
		writeFiles(snapshotDir, { "src/index.ts": "export {}" });
		const infos: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["src"],
			logger: { info: (m) => infos.push(m), warn: () => {} },
		});
		await adapter.importSnapshot(snapshotDir);
		expect(infos).toEqual(["Snapshot imported using standard copy: 1 file(s)"]);
	});
});

// ---------------------------------------------------------------------------
// SQLite integrity checks + WAL checkpoint
// ---------------------------------------------------------------------------

describe("createAstropressGitSyncAdapter — SQLite integrity + checkpoint", () => {
	function sqliteAdapter(name: string) {
		const projectDir = makeDir(`${name}-project`);
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});
		return { projectDir, adapter, warnings };
	}

	it("checkpoints the WAL and skips integrity warnings for a healthy .sqlite export", async () => {
		const { projectDir, adapter, warnings } = sqliteAdapter("sqlite-ok");
		writeFiles(projectDir, { "db/admin.sqlite": "db-bytes" });

		const targetDir = makeDir("sqlite-ok-target");
		const result = await adapter.exportSnapshot(targetDir);

		expect(result.fileCount).toBe(1);
		expect(existsSync(join(targetDir, "db", "admin.sqlite"))).toBe(true);
		expect(warnings).toHaveLength(0);
		expect(mockCheckpointWal).toHaveBeenCalledTimes(1);
		expect(mockCheckpointWal).toHaveBeenCalledWith(
			join(projectDir, "db", "admin.sqlite"),
			expect.any(Function),
		);
		// Pre-export check runs against the source with the quick mode option.
		expect(mockRunIntegrityCheck).toHaveBeenCalledWith(join(projectDir, "db", "admin.sqlite"), {
			mode: "quick",
		});
	});

	it("does not run an integrity check for non-.sqlite files", async () => {
		const { projectDir, adapter } = sqliteAdapter("sqlite-skip");
		writeFiles(projectDir, { "db/notes.txt": "plain text" });
		await adapter.exportSnapshot(makeDir("sqlite-skip-target"));
		expect(mockRunIntegrityCheck).not.toHaveBeenCalled();
		expect(mockCheckpointWal).not.toHaveBeenCalled();
	});

	it("refuses to back up a corrupt SQLite database on export", async () => {
		mockRunIntegrityCheck.mockResolvedValue({
			status: "corrupt",
			mode: "quick",
			messages: ["page 3 checksum mismatch", "freelist corrupt"],
		});
		const { projectDir, adapter } = sqliteAdapter("sqlite-corrupt");
		writeFiles(projectDir, { "db/admin.sqlite": "db-bytes" });

		await expect(adapter.exportSnapshot(makeDir("sqlite-corrupt-target"))).rejects.toThrow(
			`Refusing to back up corrupt SQLite database at ${join(
				projectDir,
				"db",
				"admin.sqlite",
			)}: page 3 checksum mismatch; freelist corrupt`,
		);
	});

	it("warns (but proceeds) when the pre-export integrity check is unavailable", async () => {
		mockRunIntegrityCheck.mockResolvedValue({
			status: "unavailable",
			mode: "quick",
			messages: [],
			error: "sqlite driver missing",
		});
		const { projectDir, adapter, warnings } = sqliteAdapter("sqlite-unavail");
		writeFiles(projectDir, { "db/admin.sqlite": "db-bytes" });

		const targetDir = makeDir("sqlite-unavail-target");
		const result = await adapter.exportSnapshot(targetDir);

		expect(result.fileCount).toBe(1);
		expect(warnings).toEqual([
			`SQLite integrity check unavailable for ${join(
				projectDir,
				"db",
				"admin.sqlite",
			)} before backup: sqlite driver missing`,
		]);
	});

	it("warns after import when the restored .sqlite database fails its integrity check", async () => {
		// Two messages so the `join("; ")` separator is observable.
		mockRunIntegrityCheck.mockResolvedValue({
			status: "corrupt",
			mode: "quick",
			messages: ["index btree malformed", "page 7 unreadable"],
		});
		const projectDir = makeDir("sqlite-restore-project");
		const snapshotDir = makeDir("sqlite-restore-snapshot");
		writeFiles(snapshotDir, { "db/admin.sqlite": "db-bytes" });
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});

		await adapter.importSnapshot(snapshotDir);

		const restoredPath = join(projectDir, "db", "admin.sqlite");
		expect(warnings).toEqual([
			`Restored SQLite database at ${restoredPath} failed integrity check (corrupt): index btree malformed; page 7 unreadable`,
		]);
		// Post-import check runs against the restored destination file.
		expect(mockRunIntegrityCheck).toHaveBeenCalledWith(restoredPath, { mode: "quick" });
	});

	it("does not run a post-import integrity check for non-.sqlite restored files", async () => {
		// Pins the `dest.endsWith(".sqlite")` half of the post-check guard: a
		// restored non-sqlite file must never trigger runIntegrityCheck.
		const projectDir = makeDir("sqlite-import-nonsqlite-project");
		const snapshotDir = makeDir("sqlite-import-nonsqlite-snapshot");
		writeFiles(snapshotDir, { "db/notes.txt": "just text" });
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: () => {} },
		});

		await adapter.importSnapshot(snapshotDir);
		expect(mockRunIntegrityCheck).not.toHaveBeenCalled();
	});

	it("uses check.error in the post-import warning when no messages are present", async () => {
		mockRunIntegrityCheck.mockResolvedValue({
			status: "unavailable",
			mode: "quick",
			messages: [],
			error: "could not open restored database",
		});
		const projectDir = makeDir("sqlite-restore-err-project");
		const snapshotDir = makeDir("sqlite-restore-err-snapshot");
		writeFiles(snapshotDir, { "db/admin.sqlite": "db-bytes" });
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});

		await adapter.importSnapshot(snapshotDir);

		expect(warnings).toEqual([
			`Restored SQLite database at ${join(
				projectDir,
				"db",
				"admin.sqlite",
			)} failed integrity check (unavailable): could not open restored database`,
		]);
	});

	it("falls back to an empty detail string when the failed check has neither messages nor error", async () => {
		mockRunIntegrityCheck.mockResolvedValue({
			status: "corrupt",
			mode: "quick",
			messages: [],
		});
		const projectDir = makeDir("sqlite-restore-empty-project");
		const snapshotDir = makeDir("sqlite-restore-empty-snapshot");
		writeFiles(snapshotDir, { "db/admin.sqlite": "db-bytes" });
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});

		await adapter.importSnapshot(snapshotDir);

		expect(warnings).toEqual([
			`Restored SQLite database at ${join(
				projectDir,
				"db",
				"admin.sqlite",
			)} failed integrity check (corrupt): `,
		]);
	});

	it("does not warn after import when the restored database passes its integrity check", async () => {
		// runIntegrityCheck defaults to status "ok" — the post-import warning
		// branch must stay closed.
		const projectDir = makeDir("sqlite-restore-ok-project");
		const snapshotDir = makeDir("sqlite-restore-ok-snapshot");
		writeFiles(snapshotDir, { "db/admin.sqlite": "db-bytes" });
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});

		await adapter.importSnapshot(snapshotDir);
		expect(warnings).toHaveLength(0);
	});

	it("runs only the post-import integrity check on import — never the pre-backup check", async () => {
		// Pins `if (options.preCheckIntegrity)`: import passes postCheckIntegrity
		// only, so the pre-backup branch must not run. A pre-check would surface
		// a "before backup" warning; only the "Restored ..." warning is allowed.
		mockRunIntegrityCheck.mockResolvedValue({
			status: "unavailable",
			mode: "quick",
			messages: [],
			error: "driver missing",
		});
		const projectDir = makeDir("sqlite-import-precheck-project");
		const snapshotDir = makeDir("sqlite-import-precheck-snapshot");
		writeFiles(snapshotDir, { "db/admin.sqlite": "db-bytes" });
		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (m) => warnings.push(m) },
		});

		await adapter.importSnapshot(snapshotDir);

		expect(warnings.some((w) => w.includes("before backup"))).toBe(false);
		expect(warnings.some((w) => w.startsWith("Restored SQLite database at"))).toBe(true);
		expect(mockRunIntegrityCheck).toHaveBeenCalledTimes(1);
	});

	it("runs only the pre-backup integrity check on export — never the post-restore check", async () => {
		// Pins the `options.postCheckIntegrity && dest.endsWith(".sqlite")` guard:
		// export passes preCheckIntegrity only, so runIntegrityCheck must be
		// called exactly once, against the source path.
		const { projectDir, adapter } = sqliteAdapter("sqlite-export-postcheck");
		writeFiles(projectDir, { "db/admin.sqlite": "db-bytes" });

		await adapter.exportSnapshot(makeDir("sqlite-export-postcheck-target"));

		expect(mockRunIntegrityCheck).toHaveBeenCalledTimes(1);
		expect(mockRunIntegrityCheck).toHaveBeenCalledWith(join(projectDir, "db", "admin.sqlite"), {
			mode: "quick",
		});
	});
});
