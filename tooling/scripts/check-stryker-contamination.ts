import { execSync, spawnSync } from "node:child_process";

// Pre-commit safety net. Root cause of the 2026-04-23 incident: stryker-sync
// ran with inPlace: true, got SIGKILLed, and left 439 source files with
// mutation instrumentation (stryMutAct_9fa48, stryCov_9fa48, // @ts-nocheck
// headers, +1 bin/ file-mode flip). The inPlace:true defaults have since
// been removed, but defense-in-depth: reject any staged diff that looks
// like Stryker leaked into source.
//
// Run: bun run tooling/scripts/check-stryker-contamination.ts
// Also wired into lefthook pre-commit as `check-stryker-contamination`.

// Stryker instrumentation markers. Nothing legitimate imports or defines
// functions with these exact names — they're hashed per-run sandbox IDs.
const CONTAMINATION_MARKERS = [/stryMutAct_[0-9a-z]{5,}/, /stryCov_[0-9a-z]{5,}/];

// New // @ts-nocheck on any file — Stryker adds this to prevent TypeScript
// from choking on the injected instrumentation. If a human legitimately
// needs ts-nocheck they should justify it explicitly, not silently.
const TS_NOCHECK_MARKER = /^\+\s*\/\/\s*@ts-nocheck\b/m;

function getStagedDiff(): string {
	const result = spawnSync("git", ["diff", "--cached", "--unified=0"], {
		encoding: "utf8",
	});
	if (result.status !== 0) return "";
	return result.stdout ?? "";
}

function splitPerFile(diff: string): Array<{ path: string; body: string }> {
	const files: Array<{ path: string; body: string }> = [];
	const chunks = diff.split(/^diff --git /m).filter(Boolean);
	for (const chunk of chunks) {
		const headerMatch = chunk.match(/^a\/(\S+) b\/\S+/);
		if (!headerMatch) continue;
		files.push({ path: headerMatch[1], body: chunk });
	}
	return files;
}

function checkFileModes(): string[] {
	// Detect executable-bit flips on bin/ files. Stryker's sandbox in-place
	// restoration drops the +x bit, silently breaking `npx astropress`.
	const result = spawnSync(
		"git",
		["diff", "--cached", "--raw", "--abbrev=40"],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) return [];
	const violations: string[] = [];
	for (const line of (result.stdout ?? "").split("\n")) {
		if (!line) continue;
		// Format: :<src-mode> <dst-mode> <src-sha> <dst-sha> <status> <path>
		const match = line.match(
			/^:(\d{6}) (\d{6}) \S+ \S+ [A-Z]\s+(\S+)/,
		);
		if (!match) continue;
		const srcMode = match[1];
		const dstMode = match[2];
		const path = match[3];
		// Flip from exec (100755) to non-exec (100644) on any file under
		// **/bin/ is never intentional outside a dedicated commit.
		if (srcMode === "100755" && dstMode === "100644" && /(^|\/)bin\//.test(path)) {
			violations.push(
				`  ${path}: executable bit dropped (100755 → 100644). This usually happens when a ` +
					`tool writes the file without preserving mode. Re-chmod and re-stage: ` +
					`\`chmod +x ${path} && git add ${path}\``,
			);
		}
	}
	return violations;
}

function main(): void {
	const diff = getStagedDiff();
	const violations: string[] = [];

	// The guard script itself must mention the markers to detect them. Exempt.
	const SELF_EXEMPT = new Set([
		"tooling/scripts/check-stryker-contamination.ts",
	]);

	for (const file of splitPerFile(diff)) {
		if (SELF_EXEMPT.has(file.path)) continue;
		// Only inspect additions — we care about NEW markers, not deletions
		const addedLines = file.body
			.split("\n")
			.filter((line) => line.startsWith("+") && !line.startsWith("+++"))
			.join("\n");
		for (const marker of CONTAMINATION_MARKERS) {
			if (marker.test(addedLines)) {
				violations.push(
					`  ${file.path}: staged diff contains Stryker instrumentation (${marker}). ` +
						`A crashed mutation run corrupted the source. Restore with \`git checkout -- ${file.path}\` ` +
						`then re-stage the real change.`,
				);
				break;
			}
		}
		if (TS_NOCHECK_MARKER.test(file.body)) {
			violations.push(
				`  ${file.path}: staged diff adds // @ts-nocheck. If intentional, justify inline and ` +
					`add the filename to tooling/readiness-truth.json allowlist. If accidental (Stryker ` +
					`leak), restore with \`git checkout -- ${file.path}\`.`,
			);
		}
	}

	violations.push(...checkFileModes());

	if (violations.length > 0) {
		console.error(
			`stryker-contamination check failed — ${violations.length} issue(s):\n`,
		);
		for (const v of violations) console.error(v);
		console.error(
			"\nThis guard runs because a SIGKILLed Stryker mutation pass previously\n" +
				"left 439 source files with instrumentation wrappers. Stryker configs\n" +
				"now default to sandbox mode (inPlace: false), so this should never\n" +
				"trigger under normal use.",
		);
		process.exit(1);
	}

	// Silent on success — pre-commit hooks should be invisible when clean.
	try {
		execSync("git diff --cached --name-only", { encoding: "utf8" });
	} catch {
		// no-op
	}
}

main();
