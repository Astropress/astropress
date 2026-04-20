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
	return (
		line.includes("// audit-ok:") ||
		line.includes("<!-- audit-ok:") ||
		line.includes("// lgtm[")
	);
}

// Check the current line and up to 2 lines above/below (handles biome reformatting
// trailing comments onto the next line)
function isSuppressedNear(lines: string[], i: number): boolean {
	for (
		let j = Math.max(0, i - 1);
		j <= Math.min(lines.length - 1, i + 2);
		j++
	) {
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
	// Detects: href="${someVar}" in template literals without escapeHtml wrapping.
	// Rule: js/html-constructed-from-input
	if (/packages\/[^/]+\/src\//.test(rel) && !rel.includes("/web-components/")) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Template literal with href="${...}" where the interpolation isn't already escaped
			if (
				/href=["'`]\${(?!escapeHtml\()/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"URL interpolated into href without escapeHtml() — wrap with escapeHtml() to prevent HTML injection [js/html-constructed-from-input]",
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

	// ── 5. Bogus CodeQL suppression syntax ──────────────────────────────────
	// Detects: // codeql[...] comments, which are NOT a real suppression mechanism.
	// Use // lgtm[<query-id>] for inline CodeQL suppressions instead.
	for (let i = 0; i < lines.length; i++) {
		if (/\/\/ codeql\[/.test(lines[i])) {
			violations.push({
				file: rel,
				line: i + 1,
				message:
					"// codeql[...] is not a valid suppression syntax — use // lgtm[<query-id>] for inline CodeQL suppressions",
			});
		}
	}

	// ── 6. writeFile with untrusted filename in import scripts ───────────────
	// Detects: writeFile(...) calls where asset.filename appears within 4 lines
	// (the call and its arguments are typically split across lines). path.basename()
	// sanitizes path traversal but CodeQL still taint-tracks the write itself.
	// Require explicit // lgtm[js/http-to-file-access] near the call.
	// Rule: js/http-to-file-access
	if (/packages\/[^/]+\/src\/import\//.test(rel)) {
		for (let i = 0; i < lines.length; i++) {
			if (!/\bwriteFile\b/.test(lines[i])) continue;
			// Check whether .filename appears on this line or the next 3 (typical arg span)
			const callWindow = lines
				.slice(i, Math.min(lines.length, i + 4))
				.join("\n");
			if (/\.filename/.test(callWindow) && !isSuppressedNear(lines, i)) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"writeFile() with HTTP-sourced filename — add // lgtm[js/http-to-file-access] after confirming path.basename() is applied [js/http-to-file-access]",
				});
			}
		}
	}

	// ── 7. Polynomial ReDoS ─────────────────────────────────────────────────
	// Detects two categories CodeQL's js/polynomial-redos rule flags:
	//   a) Nested quantifiers inside regex literals: (X+)+ or (X*)+
	//      Only fires on lines that also call a regex method (.replace/.test/etc.)
	//      to avoid false positives from for-loop increment expressions.
	//   b) /char+$/ or /[class]+$/ in .replace() — end-anchor after quantifier
	//      creates ambiguous backtracking paths on some engines.
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
						"nested quantifier in regex — (X+)+ or (X*)+ causes polynomial backtracking; add // lgtm[js/polynomial-redos] with justification if intentional [js/polynomial-redos]",
				});
			}
			// /char+$/ or /[class]+$/ in .replace() — CodeQL flags these as potentially
			// polynomial because the end anchor creates ambiguous match paths on some engines
			if (/\.replace\(\/[^/]*[+*]\$\/[gims]*,/.test(line)) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"quantifier before end-anchor in .replace() regex — CodeQL flags this as polynomial; add // lgtm[js/polynomial-redos] with justification if the pattern is linear [js/polynomial-redos]",
				});
			}
		}
	}

	// ── 8. writeFileSync with variable path in non-import src files ──────────
	// Detects: writeFileSync(varName, ...) calls in src/ (not import/) where the
	// path is not a string literal. CodeQL taint-tracks through path.join and flags
	// dynamic write targets even when the path is safely constructed.
	// Rule: js/insecure-temporary-file
	if (
		/packages\/[^/]+\/src\//.test(rel) &&
		!/\/import\//.test(rel)
	) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!/\bwriteFileSync\(/.test(line)) continue;
			// Flag if the first argument is not a plain string literal
			if (
				!/writeFileSync\(\s*["'`][^"'`]+["'`]/.test(line) &&
				!isSuppressedNear(lines, i)
			) {
				violations.push({
					file: rel,
					line: i + 1,
					message:
						"writeFileSync() with non-literal path — add // lgtm[js/insecure-temporary-file] if the path is constructed safely (e.g. randomUUID-based under a controlled directory) [js/insecure-temporary-file]",
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
