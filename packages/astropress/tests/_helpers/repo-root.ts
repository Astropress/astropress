import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Walk up from `start` until a directory containing every `marker` is found.
 * Returns the absolute path of that directory.
 *
 * Why this exists: tests that use `path.resolve(import.meta.dirname, "../../../x")`
 * to reach into repo-root paths (e.g. tooling/scripts/, examples/) work in the
 * source checkout but resolve wrong inside Stryker's sandbox copy of
 * packages/astropress/, which is one directory deeper. Walking up to a marker
 * file is stable in both layouts.
 */
export function findRepoRoot(
	start = import.meta.dirname,
	markers = ["bun.lock", "tooling", "examples"],
): string {
	let dir = start;
	for (let i = 0; i < 12; i++) {
		if (markers.every((m) => existsSync(path.join(dir, m)))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error(
		`findRepoRoot: no ancestor of ${start} contains all of ${markers.join(", ")}`,
	);
}
