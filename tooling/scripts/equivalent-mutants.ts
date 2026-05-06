// Shared helper for equivalent-mutant filtering. Both raise-baseline.ts and
// prepush-mutation-gate.ts read this catalog and exclude matching mutants
// from the score denominator (the same way Ignored / NoCoverage / static
// mutants are excluded).
//
// An "equivalent" mutant is one that produces program behavior
// indistinguishable from the original — usually because the surrounding
// code already swallows the resulting exception, or the literal value is
// a defensive guard with no observable effect.
//
// Catalog file: tooling/stryker/equivalent-mutants.json
// Schema:
//   {
//     "version": 1,
//     "description": "...",
//     "entries": [
//       { "file": "src/foo.ts", "line": 12, "column": 4,
//         "mutator": "BlockStatement", "reason": "..." }
//     ]
//   }
//
// Matching is exact on (file-suffix, line, column, mutator). Use line+col
// from the Stryker JSON report — mutators may collapse on a single line.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface EquivalentMutantEntry {
	file: string;
	line: number;
	column: number;
	mutator: string;
	reason: string;
}

interface EquivalentMutantCatalog {
	version: number;
	description?: string;
	entries: EquivalentMutantEntry[];
}

export interface MutantLocator {
	mutatorName?: string;
	location?: { start?: { line?: number; column?: number } };
}

let cached: EquivalentMutantCatalog | null = null;

function repoRoot(): string {
	return execFileSync("git", ["rev-parse", "--show-toplevel"], {
		encoding: "utf8",
	}).trim();
}

export function loadEquivalentMutants(): EquivalentMutantCatalog {
	if (cached) return cached;
	const path = join(repoRoot(), "tooling/stryker/equivalent-mutants.json");
	if (!existsSync(path)) {
		cached = { version: 1, entries: [] };
		return cached;
	}
	const parsed = JSON.parse(
		readFileSync(path, "utf8"),
	) as EquivalentMutantCatalog;
	if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
		throw new Error(
			`equivalent-mutants.json is malformed at ${path} — expected { version, entries: [] }`,
		);
	}
	cached = parsed;
	return cached;
}

export function resetEquivalentMutantCache(): void {
	cached = null;
}

/**
 * Return true when a Stryker mutant has been registered in the catalog as
 * equivalent for `fileKey`. `fileKey` is the path Stryker reports it under
 * (e.g. `src/foo.ts`); matching is suffix-based so paths reported as
 * absolute or with a sandbox prefix still resolve.
 */
export function isEquivalentMutant(
	fileKey: string,
	mutant: MutantLocator,
	catalog: EquivalentMutantCatalog = loadEquivalentMutants(),
): boolean {
	const line = mutant.location?.start?.line;
	const column = mutant.location?.start?.column;
	const mutator = mutant.mutatorName;
	if (line === undefined || column === undefined || !mutator) return false;
	for (const entry of catalog.entries) {
		if (
			entry.line === line &&
			entry.column === column &&
			entry.mutator === mutator &&
			(fileKey.endsWith(entry.file) || entry.file.endsWith(fileKey))
		) {
			return true;
		}
	}
	return false;
}
