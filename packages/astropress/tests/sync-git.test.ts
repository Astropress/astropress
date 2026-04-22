import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAstropressGitSyncAdapter } from "../src/sync/git";

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

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-git-sync-test-"));
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
		expect(result.fileCount).toBeGreaterThanOrEqual(2);
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

		const content = require("node:fs").readFileSync(
			join(projectDir, "package.json"),
			"utf8",
		);
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
});

// ---------------------------------------------------------------------------
// SQLite WAL checkpoint + reflink logging
// ---------------------------------------------------------------------------

describe("createAstropressGitSyncAdapter — SQLite + reflink", () => {
	it("copies a .sqlite file without throwing, warning on checkpoint failure", async () => {
		// A plain text file named .sqlite exercises the checkpoint path without
		// a real database — checkpoint will fail gracefully and warn, then the
		// copy proceeds normally.
		const projectDir = makeDir("project-sqlite");
		writeFiles(projectDir, { "db/admin.sqlite": "not-a-real-db" });

		const warnings: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["db"],
			logger: { info: () => {}, warn: (msg) => warnings.push(msg) },
		});

		const targetDir = makeDir("snapshot-sqlite");
		const result = await adapter.exportSnapshot(targetDir);

		expect(result.fileCount).toBe(1);
		expect(existsSync(join(targetDir, "db", "admin.sqlite"))).toBe(true);
		// A warning should have been emitted because the file is not a real SQLite DB
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("admin.sqlite");
	});

	it("logs whether reflink was used via the logger", async () => {
		const projectDir = makeDir("project-log");
		writeFiles(projectDir, { "src/index.ts": "export {}" });

		const infos: string[] = [];
		const adapter = createAstropressGitSyncAdapter({
			projectDir,
			include: ["src"],
			logger: { info: (msg) => infos.push(msg), warn: () => {} },
		});

		const targetDir = makeDir("snapshot-log");
		await adapter.exportSnapshot(targetDir);

		expect(infos.length).toBe(1);
		// Should mention either reflink or standard copy
		expect(infos[0]).toMatch(/copy-on-write|standard copy/);
	});
});
