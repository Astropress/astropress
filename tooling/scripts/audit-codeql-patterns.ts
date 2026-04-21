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

const root = process.cwd();

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

// Check the flagged line and the line directly before it.
// GitHub Advanced Security recognises // codeql[...] either inline on the
// flagged line OR on the immediately preceding standalone line — nothing further.
function isSuppressedNear(lines: string[], i: number): boolean {
	for (let j = Math.max(0, i - 1); j <= i; j++) {
		if (isSuppressed(lines[j])) return true;
	}
	return false;
}

// Wider suppression window for multi-line constructs (e.g. writeFile spread
// across several lines). Checks all lines from start to end inclusive.
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
	const rel = relative(root, file);
	const lines = src.split("\n");

	// ── 1. Path traversal: path.join with untrusted filename in import scripts ──
	// Detects: path.join(dir, asset.filename) without path.basename sanitization.
	// Rule: js/http-to-file-access
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
	// Detects: variable.includes("some.domain") used as a hostname security check.
	// Rule: js/incomplete-url-substring-sanitization
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Match: <urlVariable>.includes("<domain-looking-string>")
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
	// Detects: href="${someVar}" in template literals without proper HTML encoding.
	// Rule: js/html-constructed-from-input
	// Accepted safe patterns: escapeHtml(url) or encodeHref(url) wrapping the interpolation.
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
	// Detects: hardcoded /tmp/prefix or join(tmpdir(), "fixed-string") without mkdtemp.
	// Rule: js/insecure-temporary-file
	if (/\/tests\//.test(rel) && file.endsWith(".ts")) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Template literal or string with literal /tmp/ prefix
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
			// join(tmpdir(), "fixed-name") without mkdtemp
			// Check a 3-line window to handle multi-line mkdtemp(join(...)) calls
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
	// Detects: writeFile(...) calls where asset.filename appears within 4 lines
	// without using the validated downloadMedia/downloadMediaToFile helpers.
	// The helpers enforce URL scheme validation, SSRF prevention, content-type
	// allowlist, and file size limits before any bytes are written.
	// Rule: js/http-to-file-access
	if (/packages\/[^/]+\/src\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			if (!/\bwriteFile\b/.test(lines[i])) continue;
			const callWindow = lines
				.slice(i, Math.min(lines.length, i + 4))
				.join("\n");
			// Only flag if the bytes written come directly from fetch (not from downloadMedia)
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
	// Detects three categories CodeQL's js/polynomial-redos rule flags:
	//   a) Nested quantifiers inside regex literals: (X+)+ or (X*)+
	//      Only fires on lines that also call a regex method (.replace/.test/etc.)
	//      to avoid false positives from for-loop increment expressions.
	//   b) /char+$/ or /[class]+$/ in .replace() — end-anchor after quantifier
	//      creates ambiguous backtracking paths on some engines.
	//   c) Lazy quantifier on a negated character class: [^x]*? — the ? is
	//      redundant (the class can never overlap with the delimiter) but CodeQL
	//      still flags it as a potential super-linear path.
	// Rule: js/polynomial-redos
	if (/packages\/[^/]+\/src\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (isSuppressedNear(lines, i)) continue;
			// Nested quantifiers — require a regex method call on the same line
			// to avoid matching for-loop increment expressions like (i++).
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
			// /char+$/ or /[class]+$/ in .replace() — CodeQL flags these as potentially
			// polynomial because the end anchor creates ambiguous match paths on some engines
			if (/\.replace\(\/(?:[^/\\]|\\.)*[+*]\$\/[gims]*,/.test(line)) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"quantifier before end-anchor in .replace() regex — use a while-loop, or add // audit-ok: with justification if the pattern is provably linear [js/polynomial-redos]",
				});
			}
			// Lazy quantifier on a NEGATED character class: [^x]*? or [^abc]+?
			// The lazy ? is redundant on a negated class (it can never match its own
			// delimiter) but CodeQL still flags it as a super-linear path.
			// Fix: remove the ? — greedy and lazy behave identically on negated classes.
			// Positive classes like [\s\S]*? are intentionally excluded; CodeQL does not
			// flag those and lazy-any-char is a common cross-line match pattern.
			if (
				(/(\.replace|\.match|\.test|\.search|\.split|new RegExp)\(/.test(
					line,
				) ||
					/=\s*\/[^/]/.test(line)) && // also catches const RE = /pat/ assignments
				/\[\^[^\]]*\][*+]\?/.test(line) // audit-ok: testing source text for negated-class lazy-quantifier pattern
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"lazy quantifier on negated character class ([^x]* ?) — remove the ? (greedy and lazy are identical here) to eliminate CodeQL's polynomial-redos flag [js/polynomial-redos]",
				});
			}
			// ── 7d. Unbounded greedy [^>] in .replace() ──────────────────────
			// [^>]* or [^>]+ without a length bound in .replace() creates O(n²)
			// backtracking on non-matching HTML input (e.g. /<img([^>]*)>/).
			// Fix: add a bound like [^>]{0,2048}. Rule: js/polynomial-redos
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
	// CodeQL's js/insecure-temporary-file checks isSecureMode(): writeFileSync
	// without an explicit mode defaults to 0666 (world-readable/writable), which
	// fails the check. Always pass { mode: 0o600 } for owner-only access.
	// Rule: js/insecure-temporary-file
	if (/packages\/[^/]+\/src\//.test(rel) && !/\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!/\bwriteFileSync\(/.test(line)) continue;
			if (
				!/writeFileSync\(\s*["'`][^"'`]+["'`]/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				// Check for mode in this line or next 3 (multi-line call)
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
	// Import scripts must use downloadMedia/downloadMediaToFile from
	// import/download-media.ts which validates URL scheme, blocks SSRF,
	// and enforces content-type/size limits. Direct fetch() calls bypass
	// all of these controls. download-media.ts itself is exempt (it IS
	// the validated helper). page-crawler.ts fetches HTML pages not media
	// binary files, so it is also exempt from this check.
	// Rule: js/http-to-file-access
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
	// In Bun, `process.env.X = undefined` does NOT delete the key — it sets it to
	// the string "undefined". Code that reads the env var later (e.g. after a
	// finally-block cleanup) will see "undefined" as a truthy string, causing
	// wrong paths and unintended side-effects like creating directories named
	// "undefined/". Use `delete process.env.X` to actually unset the variable.
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
	// Detects: execSync() with a template literal containing ${var} in tooling/
	// scripts or packages/src/ where a variable is interpolated into a shell
	// command string. CodeQL flags this as js/shell-command-injection-from-
	// environment / js/indirect-uncontrolled-command-line even when the variable
	// is a known-safe internal value.
	// Fix: use execFileSync("cmd", [arg]) to pass arguments as an array,
	// bypassing the shell entirely.
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

function main(): void {
	const srcRoots = [
		join(root, "packages/astropress/src"),
		join(root, "packages/astropress/tests"),
		join(root, "packages/astropress-nexus/src"),
		join(root, "packages/astropress-nexus/tests"),
		join(root, "tooling/scripts"),
	];

	const allFiles = srcRoots
		.flatMap(tryWalk)
		.filter((f) => f.endsWith(".ts") || f.endsWith(".astro"));

	const allViolations: Violation[] = [];

	for (const file of allFiles) {
		const src = readFileSync(file, "utf8");
		allViolations.push(...checkFile(file, src));
	}

	if (allViolations.length > 0) {
		console.error(
			`\nCodeQL pattern audit failed — ${allViolations.length} violation(s):\n`,
		);
		for (const v of allViolations) {
			console.error(`  ${v.file}:${v.line}: ${v.message}`);
		}
		console.error(
			"\nFix the issues above, or add // audit-ok: <reason> to suppress a false positive.\n",
		);
		process.exit(1);
	}

	console.log(
		`CodeQL pattern audit passed (${allFiles.length} files scanned).`,
	);
}

main();
