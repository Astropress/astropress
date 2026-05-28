/**
 * Path-traversal guard for the WordPress import `exportFile` (#118).
 *
 * The REST import route (`pages/ap-api/v1/import/wordpress.ts`) reads a file
 * named by an operator-supplied `exportFile`. Untrusted, that is an
 * arbitrary-file-read sink: `/etc/passwd` or `../../secrets.env` would be read
 * and echoed into the import inventory/report. This guard confines the value to
 * a trusted import root and rejects absolute paths and `..` traversal.
 *
 * It is deliberately a *lexical* check (no filesystem access): the trust
 * boundary is the HTTP route, and a lexical guard closes the untrusted-input
 * vector without requiring the file to exist at validation time (so the route
 * stays unit-testable with a mocked importer). A symlink planted under the root
 * is out of scope — that already requires write access to the server's import
 * directory, i.e. a prior compromise. The library `importWordPress` stays a
 * general primitive that trusted callers (CLI, tests) may point at any path.
 */

import path from "node:path";

/** Raised when an `exportFile` path is unsafe. Callers surface a typed error. */
export class ImportPathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImportPathError";
	}
}

/**
 * The trusted root an import `exportFile` must resolve within. Defaults to the
 * process working directory; override with `ASTROPRESS_IMPORT_ROOT` for hosts
 * that stage uploads in a dedicated directory.
 */
export function getTrustedImportRoot(): string {
	const configured = process.env.ASTROPRESS_IMPORT_ROOT?.trim();
	return path.resolve(configured && configured.length > 0 ? configured : process.cwd());
}

/**
 * Validates an operator-supplied `exportFile` against the trusted import root.
 * Throws {@link ImportPathError} for empty, absolute, or traversing inputs and
 * for any path that lexically resolves outside the root. Returns the original
 * (relative) path on success so the caller forwards exactly what it validated.
 */
export function assertSafeImportExportFile(
	exportFile: string,
	root: string = getTrustedImportRoot(),
): string {
	const trimmed = exportFile.trim();
	if (!trimmed) {
		throw new ImportPathError("WordPress import requires an `exportFile` path.");
	}
	if (path.isAbsolute(trimmed)) {
		throw new ImportPathError("exportFile must be a relative path within the import root.");
	}
	// Reject explicit parent-traversal segments.
	if (path.normalize(trimmed).split(/[\\/]/).includes("..")) {
		throw new ImportPathError("exportFile must not traverse outside the import root.");
	}
	// Lexical containment: the resolved path must stay under the root.
	const rootResolved = path.resolve(root);
	const candidate = path.resolve(rootResolved, trimmed);
	if (candidate !== rootResolved && !candidate.startsWith(rootResolved + path.sep)) {
		throw new ImportPathError("exportFile resolves outside the import root.");
	}
	return trimmed;
}
