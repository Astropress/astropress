import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	AuditReport,
	fileContains,
	fileExists,
	listFiles,
	readText,
} from "../../../tooling/lib/audit-utils.js";

// Unit tests for the shared audit framework. Any mutation that breaks one of
// these behaviors will break 36 downstream audit scripts in CI — the unit
// tests are the first line of defense, CI is the second.

describe("audit-utils: fileExists", () => {
	it("returns true for existing files", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "exists.txt");
		writeFileSync(path, "x");
		expect(await fileExists(path)).toBe(true);
	});

	it("returns false for missing files", async () => {
		expect(await fileExists("/definitely/does/not/exist/xyz")).toBe(false);
	});

	it("returns false for empty path", async () => {
		expect(await fileExists("")).toBe(false);
	});
});

describe("audit-utils: readText", () => {
	it("returns file contents when the file exists", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "content.txt");
		writeFileSync(path, "hello\nworld\n");
		expect(await readText(path)).toBe("hello\nworld\n");
	});

	it("returns the fallback when the file does not exist", async () => {
		expect(await readText("/nope", "fallback-value")).toBe("fallback-value");
	});

	it("returns empty string by default when the file does not exist", async () => {
		expect(await readText("/nope")).toBe("");
	});
});

describe("audit-utils: fileContains", () => {
	it("returns true for a string match", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "c.txt");
		writeFileSync(path, "alpha beta gamma");
		expect(await fileContains(path, "beta")).toBe(true);
	});

	it("returns false for a string miss", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "c.txt");
		writeFileSync(path, "alpha beta gamma");
		expect(await fileContains(path, "delta")).toBe(false);
	});

	it("returns true for a regex match", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "c.txt");
		writeFileSync(path, "route123 here");
		expect(await fileContains(path, /route\d+/)).toBe(true);
	});

	it("returns false for a regex miss", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		const path = join(dir, "c.txt");
		writeFileSync(path, "plain text");
		expect(await fileContains(path, /\d{5}/)).toBe(false);
	});

	it("returns false for missing files regardless of pattern", async () => {
		expect(await fileContains("/nope", "anything")).toBe(false);
		expect(await fileContains("/nope", /anything/)).toBe(false);
	});
});

describe("audit-utils: listFiles", () => {
	async function makeTree(root: string) {
		await mkdir(join(root, "sub"), { recursive: true });
		await writeFile(join(root, "a.ts"), "");
		await writeFile(join(root, "b.js"), "");
		await writeFile(join(root, "c.md"), "");
		await writeFile(join(root, "sub", "d.ts"), "");
	}

	it("returns an empty array for a missing directory", async () => {
		expect(await listFiles("/missing")).toEqual([]);
	});

	it("returns top-level entries by default", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		await makeTree(dir);
		const out = (await listFiles(dir)).sort();
		expect(out).toEqual(["a.ts", "b.js", "c.md", "sub"]);
	});

	it("recurses when recursive=true", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		await makeTree(dir);
		const out = await listFiles(dir, { recursive: true });
		expect(out).toContain(join("sub", "d.ts"));
	});

	it("filters by extensions", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		await makeTree(dir);
		const out = await listFiles(dir, { extensions: [".ts"] });
		expect(out).toEqual(["a.ts"]);
	});

	it("applies the exclude list", async () => {
		const dir = mkdtempSync(join(tmpdir(), "audit-utils-"));
		await makeTree(dir);
		const out = await listFiles(dir, { exclude: ["b.js"] });
		expect(out).not.toContain("b.js");
		expect(out).toContain("a.ts");
	});
});

describe("audit-utils: AuditReport state", () => {
	// Note: finish() is not unit-tested because it calls process.exit, which
	// terminates the runner. The 36 audit scripts in CI are the integration
	// test for finish() — any behavior regression there fails the CI gate.

	it("starts with no violations and failed=false", () => {
		const r = new AuditReport("t");
		expect(r.failed).toBe(false);
		expect(r.count).toBe(0);
	});

	it("tracks violations additively", () => {
		const r = new AuditReport("t");
		r.add("v1");
		r.add("v2");
		expect(r.count).toBe(2);
		expect(r.failed).toBe(true);
	});

	it("remains failed=false after zero add() calls", () => {
		const r = new AuditReport("t");
		expect(r.failed).toBe(false);
	});

	it("counts each add() call, including duplicates", () => {
		const r = new AuditReport("t");
		r.add("same");
		r.add("same");
		r.add("same");
		expect(r.count).toBe(3);
	});

	it("does not leak state between instances", () => {
		const a = new AuditReport("a");
		const b = new AuditReport("b");
		a.add("x");
		expect(b.count).toBe(0);
		expect(b.failed).toBe(false);
	});
});
