/**
 * Workspace prepare-hook audit.
 *
 * Ensures that every internal workspace package referenced by an example's
 * dependencies has a `prepare` script so `bun install` builds dist/ and the
 * example can import the package without a separate manual build step.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AuditReport, fromRoot, runAudit } from "../lib/audit-utils.js";

const EXAMPLES_DIR = fromRoot("examples");
const PACKAGES_DIR = fromRoot("packages");

async function readJson(path: string): Promise<Record<string, unknown>> {
	const raw = await readFile(path, "utf8");
	return JSON.parse(raw) as Record<string, unknown>;
}

runAudit("workspace-prepare", async () => {
	const report = new AuditReport("workspace-prepare");

	// Collect all workspace package names → directory names
	const { readdir } = await import("node:fs/promises");
	const pkgDirs = await readdir(PACKAGES_DIR);
	const workspacePackages = new Map<string, string>(); // name → dir path
	for (const dir of pkgDirs) {
		const pkgPath = join(PACKAGES_DIR, dir, "package.json");
		try {
			const pkg = await readJson(pkgPath);
			const name = pkg["name"] as string | undefined;
			if (name) workspacePackages.set(name, join(PACKAGES_DIR, dir));
		} catch {
			// no package.json — skip
		}
	}

	// For each example, find its workspace: deps and check they have prepare
	const exampleDirs = await readdir(EXAMPLES_DIR);
	for (const dir of exampleDirs) {
		const examplePkgPath = join(EXAMPLES_DIR, dir, "package.json");
		let examplePkg: Record<string, unknown>;
		try {
			examplePkg = await readJson(examplePkgPath);
		} catch {
			continue;
		}

		const allDeps = {
			...(examplePkg["dependencies"] as Record<string, string> | undefined),
			...(examplePkg["devDependencies"] as Record<string, string> | undefined),
		};

		for (const [depName, depVersion] of Object.entries(allDeps)) {
			if (!(depVersion as string).startsWith("workspace:")) continue;
			const pkgDir = workspacePackages.get(depName);
			if (!pkgDir) continue;

			const depPkg = await readJson(join(pkgDir, "package.json"));
			const scripts = depPkg["scripts"] as Record<string, string> | undefined;
			if (!scripts?.["prepare"]) {
				report.add(
					`examples/${dir} depends on workspace package "${depName}" which has no "prepare" script — ` +
						`dist/ will not exist after bun install, causing import errors in the example`,
				);
			}
		}
	}

	report.finish("workspace-prepare audit passed — all workspace deps consumed by examples have a prepare script");
});
