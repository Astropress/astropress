// Path-traversal guard for the untrusted WordPress import exportFile (#118).
// Asserts the deny-list (absolute paths, `..` traversal, escapes) AND the
// allow path (a relative path inside the root) — not just the empty case.
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
	assertSafeImportExportFile,
	getTrustedImportRoot,
	ImportPathError,
} from "../src/import/import-path.js";

const ROOT = path.resolve("/srv/imports");

describe("assertSafeImportExportFile", () => {
	it("accepts a plain relative filename inside the root", () => {
		expect(assertSafeImportExportFile("export.xml", ROOT)).toBe("export.xml");
	});

	it("accepts a relative path into a subdirectory of the root", () => {
		expect(assertSafeImportExportFile("uploads/wp.xml", ROOT)).toBe("uploads/wp.xml");
	});

	it("rejects an empty or whitespace-only path", () => {
		expect(() => assertSafeImportExportFile("   ", ROOT)).toThrow(ImportPathError);
	});

	it("rejects an absolute path", () => {
		expect(() => assertSafeImportExportFile("/etc/passwd", ROOT)).toThrow(/relative/i);
	});

	it("rejects a parent-traversal path", () => {
		expect(() => assertSafeImportExportFile("../../etc/passwd", ROOT)).toThrow(/traverse/i);
	});

	it("rejects a traversal hidden mid-path", () => {
		expect(() => assertSafeImportExportFile("uploads/../../escape.xml", ROOT)).toThrow(/traverse/i);
	});

	it("rejects a single parent segment", () => {
		expect(() => assertSafeImportExportFile("..", ROOT)).toThrow(ImportPathError);
	});

	it("returns the original (un-normalised) relative path on success", () => {
		// The caller forwards exactly what was validated.
		expect(assertSafeImportExportFile("./nested/file.xml", ROOT)).toBe("./nested/file.xml");
	});

	it("getTrustedImportRoot honours ASTROPRESS_IMPORT_ROOT and defaults to cwd", () => {
		const prev = process.env.ASTROPRESS_IMPORT_ROOT;
		try {
			process.env.ASTROPRESS_IMPORT_ROOT = "/srv/imports";
			expect(getTrustedImportRoot()).toBe(path.resolve("/srv/imports"));
			delete process.env.ASTROPRESS_IMPORT_ROOT;
			expect(getTrustedImportRoot()).toBe(path.resolve(process.cwd()));
		} finally {
			if (prev === undefined) delete process.env.ASTROPRESS_IMPORT_ROOT;
			else process.env.ASTROPRESS_IMPORT_ROOT = prev;
		}
	});
});
