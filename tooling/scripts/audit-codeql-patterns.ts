/**
 * Detects pattern classes that GitHub Advanced Security (CodeQL) flags under
 * the 'security-and-quality' query suite, so they're caught pre-commit rather
 * than discovered after a push is rejected or a PR review flags them.
 *
 * Suppression: add `// audit-ok: <reason>` on the same line to silence a
 * specific finding.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { AuditReport, fromRoot, ROOT, runAudit } from "../lib/audit-utils.js";

type Violation = { file: string; line: number; message: string };

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(p));
		else if (entry.isFile()) out.push(p);
	}
	return out;
}

function tryWalk(dir: string): string[] {
	try {
		statSync(dir);
		return walk(dir);
	} catch {
		return [];
	}
}

function isSuppressed(line: string): boolean {
	return line.includes("// audit-ok:") || line.includes("<!-- audit-ok:");
}

function isSuppressedNear(lines: string[], i: number): boolean {
	for (let j = Math.max(0, i - 1); j <= i; j++) {
		if (isSuppressed(lines[j])) return true;
	}
	return false;
}

function isSuppressedInWindow(
	lines: string[],
	start: number,
	end: number,
): boolean {
	for (let j = Math.max(0, start); j <= Math.min(lines.length - 1, end); j++) {
		if (isSuppressed(lines[j])) return true;
	}
	return false;
}

function checkFile(file: string, src: string): Violation[] {
	const violations: Violation[] = [];
	const rel = relative(ROOT, file);
	const lines = src.split("\n");

	// ── 1. Path traversal: path.join with untrusted filename in import scripts ──
	if (/packages\/[^/]+\/src\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/path\.join\(/.test(line) && /\.filename/.test(line)) {
				const window = lines
					.slice(Math.max(0, i - 3), Math.min(lines.length, i + 3))
					.join("\n");
				if (!/path\.basename/.test(window) && !isSuppressedNear(lines, i)) {
					violations.push({
						file: rel,
						line: i + 1,
						message:
							"path.join() with untrusted filename — use path.basename() to prevent path traversal [js/http-to-file-access]",
					});
				}
			}
		}
	}

	// ── 2. URL substring hostname validation ─────────────────────────────────
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (
			/\b\w*[Uu][Rr][Ll]\w*\.includes\(["'][^"']*\.[^"']*["']\)/.test(line) &&
			!isSuppressedNear(lines, i)
		) {
			violations.push({
				file: rel,
				line: i + 1,
				message:
					"URL hostname check via .includes() — use new URL() and validate .hostname instead [js/incomplete-url-substring-sanitization]",
			});
		}
	}

	// ── 3. Unsafe URL interpolation in HTML href attributes ───────────────────
	if (/packages\/[^/]+\/src\//.test(rel) && !rel.includes("/web-components/")) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (
				/href=["'`]\${(?!escapeHtml\()(?!encodeHref\()/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"URL interpolated into href without HTML encoding — wrap with escapeHtml() or encodeHref() to prevent HTML injection [js/html-constructed-from-input]",
				});
			}
		}
	}

	// ── 4. Insecure predictable /tmp paths in test files ─────────────────────
	if (/\/tests\//.test(rel) && file.endsWith(".ts")) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (
				/[`'"][/\\]tmp[/\\]astropress/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"predictable /tmp path — use mkdtempSync(join(tmpdir(), 'prefix-')) for collision-safe temp dirs [js/insecure-temporary-file]",
				});
			}
			if (
				/join\(tmpdir\(\)\s*,\s*["'][^"']*["']\)/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				const ctx = lines
					.slice(Math.max(0, i - 2), Math.min(lines.length, i + 2))
					.join("\n");
				if (!/mkdtemp/.test(ctx)) {
					violations.push({
						file: rel,
						line: i + 1,
						message:
							"fixed tmpdir() path — use mkdtempSync(join(tmpdir(), 'prefix-')) instead [js/insecure-temporary-file]",
					});
				}
			}
		}
	}

	// ── 6. writeFile with HTTP-sourced bytes in import scripts ─────────────────
	if (/packages\/[^/]+\/src\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			if (!/\bwriteFile\b/.test(lines[i])) continue;
			const callWindow = lines
				.slice(i, Math.min(lines.length, i + 4))
				.join("\n");
			const fetchWindow = lines
				.slice(Math.max(0, i - 10), i + 4)
				.join("\n");
			if (
				/\.filename/.test(callWindow) &&
				!/downloadMedia|downloadMediaToFile/.test(fetchWindow) &&
				!isSuppressedInWindow(lines, i - 1, i + 4)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"writeFile() in import script with HTTP-sourced filename — use downloadMediaToFile() from import/download-media.ts which validates URL scheme, blocks SSRF, and enforces content-type/size limits [js/http-to-file-access]",
				});
			}
		}
	}

	// ── 7. Polynomial ReDoS ─────────────────────────────────────────────────
	if (/packages\/[^/]+\/src\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (isSuppressedNear(lines, i)) continue;
			if (
				/(\.replace|\.match|\.test|\.search|\.split)\(/.test(line) &&
				/\([^)]*[+*]\)[+*]/.test(line)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"nested quantifier in regex — (X+)+ or (X*)+ causes polynomial backtracking; use a while-loop or add // audit-ok: with justification if provably linear [js/polynomial-redos]",
				});
			}
			if (/\.replace\(\/(?:[^/\\]|\\.)*[+*]\$\/[gims]*,/.test(line)) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"quantifier before end-anchor in .replace() regex — use a while-loop, or add // audit-ok: with justification if the pattern is provably linear [js/polynomial-redos]",
				});
			}
			if (
				(/(\.replace|\.match|\.test|\.search|\.split|new RegExp)\(/.test(
					line,
				) ||
					/=\s*\/[^/]/.test(line)) &&
				/\[\^[^\]]*\][*+]\?/.test(line) // audit-ok: testing source text for negated-class lazy-quantifier pattern
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"lazy quantifier on negated character class ([^x]* ?) — remove the ? (greedy and lazy are identical here) to eliminate CodeQL's polynomial-redos flag [js/polynomial-redos]",
				});
			}
			if (
				/\.replace\(/.test(line) &&
				/\[\^>[^\]]*\][*+](?!\?)(?!\{)/.test(line) // audit-ok: testing source text for unbounded [^>] greedy quantifier
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"unbounded [^>]* or [^>]+ in .replace() — add a length bound (e.g. [^>]{0,2048}) to prevent O(n²) backtracking on non-matching input [js/polynomial-redos]",
				});
			}
		}
	}

	// ── 8. writeFileSync without secure mode in non-import src files ─────────
	if (/packages\/[^/]+\/src\//.test(rel) && !/\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!/\bwriteFileSync\(/.test(line)) continue;
			if (
				!/writeFileSync\(\s*["'`][^"'`]+["'`]/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				const callWindow = lines
					.slice(i, Math.min(lines.length, i + 4))
					.join("\n");
				if (!/0o600|0o400/.test(callWindow)) {
					violations.push({
						file: rel,
						line: i + 1,
						message:
							"writeFileSync() with variable path and no secure mode — add { mode: 0o600 } as the third argument to prevent world-readable files (CodeQL js/insecure-temporary-file checks isSecureMode())",
					});
				}
			}
		}
	}

	// ── 11. Raw fetch() in import scripts without downloadMedia ─────────────
	if (
		/packages\/[^/]+\/src\/import\//.test(rel) &&
		!rel.endsWith("download-media.ts") &&
		!rel.endsWith("page-crawler.ts")
	) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/\bfetch\(/.test(line) && !isSuppressedNear(lines, i)) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"raw fetch() in import script — use downloadMedia() or downloadMediaToFile() from import/download-media.ts which enforces URL validation, SSRF prevention, content-type allowlist, and size limits [js/http-to-file-access]",
				});
			}
		}
	}

	// ── 9. process.env.X = undefined in test files (Bun env-string bug) ────────
	if (/\/tests\//.test(rel) && file.endsWith(".ts")) {
		for (let i = 0; i < lines.length; i++) {
			if (
				/process\.env\.\w+\s*=\s*undefined\b/.test(lines[i]) &&
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						'process.env.X = undefined sets the key to the string "undefined" in Bun — use `delete process.env.X` (with biome-ignore lint/performance/noDelete: comment) to actually unset it',
				});
			}
		}
	}

	// ── 10. execSync with template literal interpolation ────────────────────
	if (/tooling\/scripts\//.test(rel) || /packages\/[^/]+\/src\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (
				/\bexecSync\(`[^`]*\$\{/.test(line) && // audit-ok: regex literal for detection, not an actual execSync call
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"execSync() with template literal interpolation — replace with execFileSync('cmd', [arg]) to avoid shell injection; or add // audit-ok: with justification if the value is a hardcoded constant [js/shell-command-injection-from-environment]",
				});
			}
		}
	}

	return violations;
}

async function main() {
	const report = new AuditReport("CodeQL pattern");

	const srcRoots = [
		fromRoot("packages/astropress/src"),
		fromRoot("packages/astropress/tests"),
		fromRoot("packages/astropress-nexus/src"),
		fromRoot("packages/astropress-nexus/tests"),
		fromRoot("tooling/scripts"),
	];

	const allFiles = srcRoots
		.flatMap(tryWalk)
		.filter((f) => f.endsWith(".ts") || f.endsWith(".astro"));

	for (const file of allFiles) {
		const src = readFileSync(file, "utf8");
		for (const v of checkFile(file, src)) {
			report.add(`${v.file}:${v.line}: ${v.message}`);
		}
	}

	if (report.failed) {
		console.error(
			"\nFix the issues above, or add // audit-ok: <reason> to suppress a false positive.\n",
		);
	}

	report.finish(
		`CodeQL pattern audit passed (${allFiles.length} files scanned).`,
	);
}

runAudit("CodeQL pattern", main);
