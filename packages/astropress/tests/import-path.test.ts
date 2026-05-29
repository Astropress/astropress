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

	it("the empty-input error carries the ImportPathError name and exportFile message", () => {
		// `.toThrow(ImportPathError)` above only checks instanceof; assert the
		// name field and the specific message so blanking either is caught.
		try {
			assertSafeImportExportFile("", ROOT);
			throw new Error("expected a throw");
		} catch (err) {
			expect(err).toBeInstanceOf(ImportPathError);
			expect((err as Error).name).toBe("ImportPathError");
			expect((err as Error).message).toMatch(/exportFile/);
		}
	});

	it("accepts a single '.' which resolves to the root itself (boundary: candidate === root)", () => {
		// '.' has no `..` segment and resolves to the root exactly. The lexical
		// containment guard must treat root-itself as inside the root.
		expect(assertSafeImportExportFile(".", ROOT)).toBe(".");
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

	it("getTrustedImportRoot trims surrounding whitespace before resolving the override", () => {
		// Kills the `.trim()`-removal mutant: a padded value must resolve to the
		// trimmed path, not to a literal directory with leading/trailing spaces.
		const prev = process.env.ASTROPRESS_IMPORT_ROOT;
		try {
			process.env.ASTROPRESS_IMPORT_ROOT = "  /srv/imports  ";
			expect(getTrustedImportRoot()).toBe(path.resolve("/srv/imports"));
		} finally {
			if (prev === undefined) delete process.env.ASTROPRESS_IMPORT_ROOT;
			else process.env.ASTROPRESS_IMPORT_ROOT = prev;
		}
	});

	it("getTrustedImportRoot falls back to cwd for a whitespace-only override", () => {
		// `configured && configured.length > 0` rejects an all-whitespace value
		// (trimmed to "") and uses cwd; asserts the length guard, not just unset.
		const prev = process.env.ASTROPRESS_IMPORT_ROOT;
		try {
			process.env.ASTROPRESS_IMPORT_ROOT = "    ";
			expect(getTrustedImportRoot()).toBe(path.resolve(process.cwd()));
		} finally {
			if (prev === undefined) delete process.env.ASTROPRESS_IMPORT_ROOT;
			else process.env.ASTROPRESS_IMPORT_ROOT = prev;
		}
	});
});
