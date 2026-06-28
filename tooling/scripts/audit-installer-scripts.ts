/**
 * Installer script correctness audit.
 *
 * Checks that install.sh and install.ps1:
 *   1. Invoke cargo with --manifest-path (no bare `cargo build/run/test` that
 *      would fail when there is no Cargo.toml at the repo root).
 *   2. Use `bun x playwright` instead of `npx … playwright` so the lockfile-
 *      pinned browser revision is used and npm is never invoked in a Bun repo.
 *   3. install.sh handles MINGW/MSYS/CYGWIN uname prefixes with a redirect to
 *      install.ps1 rather than a generic die or silent fall-through (#159).
 *
 * Also checks that package.json does not carry an `overrides.astro` value that
 * contradicts the direct `dependencies.astro` entry (npm EOVERRIDE).
 */

import { readFile } from "node:fs/promises";
import { AuditReport, fromRoot, runAudit } from "../lib/audit-utils.js";

const INSTALL_SCRIPTS = [
	fromRoot("tooling/scripts/install.sh"),
	fromRoot("tooling/scripts/install.ps1"),
];

// Matches npx invocations that call playwright
const NPX_PLAYWRIGHT_RE = /npx\b.*playwright/;

async function checkScript(path: string, report: AuditReport): Promise<void> {
	let src: string;
	try {
		src = await readFile(path, "utf8");
	} catch {
		report.add(`${path}: file not found`);
		return;
	}

	const lines = src.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		// Skip comment lines and lines where the match is only inside a quoted string
		// (warn/info/ok/echo/Write-Host messages).
		if (/^\s*(#|\/\/)/.test(line)) continue;
		// The actual command starts after optional leading whitespace; if the first
		// non-whitespace token is a shell built-in (warn/info/ok/echo/Write-Host)
		// then the rest is a string argument — not an invocation.
		const isStringArg = /^\s*(warn|info|ok|echo|Write-Host)\s/.test(line);
		if (isStringArg) continue;

		if (/cargo\s+(build|run|test)\b/.test(line) && !line.includes("--manifest-path")) {
			report.add(`${path}:${lineNum}: bare \`cargo ${/cargo\s+(\w+)/.exec(line)?.[1]}\` without --manifest-path — will fail when no Cargo.toml exists at the repo root`);
		}

		if (NPX_PLAYWRIGHT_RE.test(line)) {
			report.add(`${path}:${lineNum}: \`npx … playwright\` invokes npm in a Bun-managed repo; use \`bun x playwright\` instead`);
		}
	}
}

async function checkPackageJsonOverrides(report: AuditReport): Promise<void> {
	const pkgPath = fromRoot("package.json");
	let raw: string;
	try {
		raw = await readFile(pkgPath, "utf8");
	} catch {
		report.add(`${pkgPath}: file not found`);
		return;
	}

	let pkg: Record<string, unknown>;
	try {
		pkg = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		report.add(`${pkgPath}: invalid JSON`);
		return;
	}

	const overrides = pkg["overrides"] as Record<string, string> | undefined;
	const deps = pkg["dependencies"] as Record<string, string> | undefined;

	if (!overrides || !deps) return;

	for (const [name, overrideRange] of Object.entries(overrides)) {
		if (name in deps) {
			const depRange = deps[name];
			// Strip leading ^ ~ from both and compare major.minor roots
			const normalize = (r: string) => r.replace(/^[\^~]/, "");
			if (normalize(overrideRange) !== normalize(depRange)) {
				report.add(
					`package.json: overrides.${name} (${overrideRange}) contradicts direct dependency range (${depRange}) — npm will abort with EOVERRIDE`,
				);
			}
		}
	}
}

async function checkMingwRedirect(report: AuditReport): Promise<void> {
	const shPath = fromRoot("tooling/scripts/install.sh");
	let src: string;
	try {
		src = await readFile(shPath, "utf8");
	} catch {
		report.add(`${shPath}: file not found`);
		return;
	}

	// install.sh must have a case arm matching MINGW*/MSYS*/CYGWIN* that
	// redirects to install.ps1 rather than hitting the generic die or
	// falling through to POSIX-only code that will not work on Windows.
	const hasMingwArm =
		/MINGW\*\|MSYS\*\|CYGWIN\*/.test(src) ||
		/MINGW\*[^)]*\|[^)]*MSYS\*[^)]*\|[^)]*CYGWIN\*/.test(src);
	if (!hasMingwArm) {
		report.add(
			`${shPath}: no MINGW*/MSYS*/CYGWIN* case arm found — ` +
				`Git Bash users on Windows will hit the generic die with no actionable guidance (see #159)`,
		);
		return;
	}

	if (!src.includes("install.ps1")) {
		report.add(
			`${shPath}: MINGW/MSYS/CYGWIN arm does not reference install.ps1 — ` +
				`the redirect message must tell users which script to run instead`,
		);
	}
}

runAudit("installer-scripts", async () => {
	const report = new AuditReport("installer-scripts");

	await Promise.all([
		...INSTALL_SCRIPTS.map((s) => checkScript(s, report)),
		checkPackageJsonOverrides(report),
		checkMingwRedirect(report),
	]);

	report.finish(
		"installer-scripts audit passed — no bare cargo calls, no npx playwright, no override conflicts, MINGW redirect present",
	);
});
