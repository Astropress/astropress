// Static audit that prevents user-visible English strings from leaking through
// the admin UI under non-English locales. Catches the specific patterns that
// caused regressions in PR #69:
//
//   1. Raw enum rendering: `{record.status}` / `{record.kind}` in JSX —
//      these emit untranslated lowercase tokens like "draft", "post".
//   2. Locale-less date formatting: `.toLocaleString()` with no locale arg —
//      always renders in the system locale, ignoring the admin's selection.
//   3. Hardcoded `"en-US"` (or any other BCP-47 string) passed to toLocaleString —
//      forces the date format regardless of the admin locale.
//
// Allowlist is deliberately tiny. If a new exemption is needed, add it here
// with a comment explaining why translation is impossible at that callsite.

import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { AuditReport, fromRoot, runAudit } from "../lib/audit-utils.js";

const ADMIN_DIRS = [
	"packages/astropress/pages/ap-admin",
	"packages/astropress/components",
];

interface Finding {
	file: string;
	line: number;
	rule: string;
	snippet: string;
}

async function walkAstroFiles(dir: string, out: string[]): Promise<void> {
	let entries: Dirent[];
	try {
		entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			await walkAstroFiles(full, out);
		} else if (entry.name.endsWith(".astro")) {
			out.push(full);
		}
	}
}

const RAW_STATUS = /\{[^}]*?\brecord\.status\b[^}]*?\}/g;
const RAW_KIND = /\{[^}]*?\brecord\.kind\b[^}]*?\}/g;
// `.toLocaleString(...)` where the first arg is missing or is a hardcoded
// locale string literal. We accept identifiers like `adminLocale`, function
// calls, `Astro.*`, or anything that isn't a plain quoted string.
const TO_LOCALE_STRING = /\.toLocaleString\(([^)]*)\)/g;
// Heuristic for "wrapped in t(...)" or "wrapped in helper": the JSX expression
// contains a call (paren). Used to whitelist patterns like
// `{statusLabel(record.status)}` and `{tStatus(record.status)}`.
const HAS_CALL = /\([^)]*\bstatus\b[^)]*\)|\([^)]*\bkind\b[^)]*\)/;

function findLineNumber(src: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
	return line;
}

function snippet(src: string, index: number, len: number): string {
	const start = src.lastIndexOf("\n", index) + 1;
	const end = src.indexOf("\n", index + len);
	return src
		.slice(start, end === -1 ? src.length : end)
		.trim()
		.slice(0, 140);
}

function checkFile(path: string, src: string): Finding[] {
	const findings: Finding[] = [];
	const rel = path.replace(`${fromRoot()}/`, "");

	for (const re of [RAW_STATUS, RAW_KIND] as const) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null = re.exec(src);
		for (; m !== null; m = re.exec(src)) {
			const expr = m[0];
			// Skip control-flow / filter expressions like
			//   posts.filter((record) => record.status === "published")
			// — those don't render the value as visible text.
			if (
				expr.includes("===") ||
				expr.includes("!==") ||
				expr.includes("==") ||
				expr.includes("?.") ||
				expr.includes("filter(") ||
				expr.includes("map(") ||
				expr.includes("&&") ||
				expr.includes("href=") ||
				expr.includes("class=") ||
				expr.includes("`")
			) {
				continue;
			}
			// Skip if wrapped in a translation/labelling helper.
			if (HAS_CALL.test(expr)) continue;
			// Skip ternaries that resolve to translated branches —
			// e.g. `{record.status === "draft" ? t("...") : t("...")}`.
			if (expr.includes("?") && expr.includes("t(")) continue;

			findings.push({
				file: rel,
				line: findLineNumber(src, m.index),
				rule: re === RAW_STATUS ? "raw-status-enum" : "raw-kind-enum",
				snippet: snippet(src, m.index, expr.length),
			});
		}
	}

	TO_LOCALE_STRING.lastIndex = 0;
	let m: RegExpExecArray | null = TO_LOCALE_STRING.exec(src);
	for (; m !== null; m = TO_LOCALE_STRING.exec(src)) {
		const args = m[1].trim();
		// Empty argument list — uses system locale.
		if (args === "") {
			findings.push({
				file: rel,
				line: findLineNumber(src, m.index),
				rule: "no-locale-arg",
				snippet: snippet(src, m.index, m[0].length),
			});
			continue;
		}
		// First argument is a hardcoded BCP-47 string literal like "en-US".
		const firstArg = args.split(",")[0].trim();
		if (
			/^"[a-z]{2}(-[A-Z]{2})?"$/.test(firstArg) ||
			/^'[a-z]{2}(-[A-Z]{2})?'$/.test(firstArg)
		) {
			findings.push({
				file: rel,
				line: findLineNumber(src, m.index),
				rule: "hardcoded-locale",
				snippet: snippet(src, m.index, m[0].length),
			});
		}
	}

	return findings;
}

async function main() {
	const report = new AuditReport("admin-i18n-leaks");
	const files: string[] = [];
	for (const dir of ADMIN_DIRS) await walkAstroFiles(fromRoot(dir), files);

	let total = 0;
	for (const file of files) {
		const src = await readFile(file, "utf8");
		const findings = checkFile(file, src);
		for (const f of findings) {
			total++;
			report.add(`[${f.rule}] ${f.file}:${f.line} — ${f.snippet}`);
		}
	}

	report.finish(
		`admin-i18n-leaks audit passed — scanned ${files.length} .astro files, no raw-enum or locale-less rendering detected.`,
	);
}

runAudit("admin-i18n-leaks", main);
