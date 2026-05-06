#!/usr/bin/env bun
/**
 * audit-boundary-types — find weak-typing patterns at module boundaries.
 *
 * TS:
 *   - `as { ... }` casts on caught errors and unknowns
 *   - exported function returns/params typed `Record<string, unknown>` or `unknown[]`
 *   - `?? <literal>` chains where LHS comes from JSON.parse / process.env
 *
 * Rust (excluding `#[cfg(test)]` blocks and `tests/` dirs):
 *   - `Result<T, String>` and `Result<T, &str>` returns
 *   - `panic!`, `.unwrap()`, `.expect(` outside tests
 *
 * Pragma support — `// audit-boundary: opaque-passthrough -- <reason>` on the
 * same line OR the line immediately above a match excludes it from the live
 * count. Pragma'd matches are still tracked (and reported) separately so a
 * future audit can review whether the rationale still holds. Use this
 * sparingly: only for genuine pass-through where introducing a typed shape
 * would add no information (e.g. a logger forwarding payloads it never
 * reads).
 *
 * Hardened gate: every category must be 0. Genuine pass-through must
 * carry a pragma; otherwise the audit fails.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "tooling/audit-output/boundary-types.json";

function rgLines(pattern: string, glob: string, extraArgs = ""): string[] {
	try {
		const out = execFileSync(
			"bash",
			["-c", `grep -rEn ${extraArgs} '${pattern}' ${glob} 2>/dev/null || true`],
			{ encoding: "utf8" },
		);
		return out.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

const TS_GLOB = "packages/astropress/src --include='*.ts'";
const RUST_GLOB = "crates/astropress-cli/src --include='*.rs'";

const PRAGMA = /\/\/\s*audit-boundary:\s*opaque-passthrough/;
const fileCache = new Map<string, string[]>();

function readFileLines(file: string): string[] | null {
	const cached = fileCache.get(file);
	if (cached) return cached;
	try {
		const lines = readFileSync(file, "utf8").split("\n");
		fileCache.set(file, lines);
		return lines;
	} catch {
		return null;
	}
}

interface PragmaSplit {
	live: string[];
	pragma: string[];
}

function splitByPragma(matches: string[]): PragmaSplit {
	const live: string[] = [];
	const pragma: string[] = [];
	for (const match of matches) {
		const m = match.match(/^([^:]+):(\d+):(.*)$/);
		if (!m) {
			live.push(match);
			continue;
		}
		const [, file, lineStr, content] = m;
		if (PRAGMA.test(content)) {
			pragma.push(match);
			continue;
		}
		const lineNum = Number.parseInt(lineStr, 10);
		const lines = readFileLines(file);
		if (!lines) {
			live.push(match);
			continue;
		}
		const prev = lines[lineNum - 2] ?? "";
		if (PRAGMA.test(prev)) pragma.push(match);
		else live.push(match);
	}
	return { live, pragma };
}

const tsCastsOnError = splitByPragma(
	rgLines("\\(\\s*err\\s+as\\s+\\{|\\(\\s*error\\s+as\\s+\\{|\\(\\s*e\\s+as\\s+\\{", TS_GLOB),
);
const tsRecordUnknown = splitByPragma(rgLines("Record<string,\\s*unknown>", TS_GLOB));
const tsUnknownArr = splitByPragma(rgLines(":\\s*unknown\\[\\]", TS_GLOB));
const tsEnvFallback = splitByPragma(rgLines("process\\.env\\.[A-Z_]+\\s*\\?\\?", TS_GLOB));
const tsJsonParseFallback = splitByPragma(rgLines("JSON\\.parse\\([^)]+\\)\\s*\\?\\?", TS_GLOB));

const rustResultString = splitByPragma(rgLines("\\bResult<.*,\\s*(String|&str)\\b", RUST_GLOB));
// Filter unwrap/expect/panic to production code only. Tests are allowed to
// .unwrap()/.expect()/panic! freely. Detect:
//   - paths under tests/ directories
//   - filenames matching *_tests.rs / *_test.rs / tests.rs
//   - lines inside #[cfg(test)] mod blocks of otherwise-production files
function isInTestCfg(file: string, lineNum: number): boolean {
	const lines = readFileLines(file);
	if (!lines) return false;
	let depth = 0;
	let inTestCfg = false;
	for (let i = 0; i < lineNum && i < lines.length; i++) {
		const line = lines[i];
		if (/^\s*#\[cfg\(test\)\]\s*$/.test(line)) {
			// The next `mod` opens the test cfg block.
			for (let j = i + 1; j <= lineNum && j < lines.length; j++) {
				if (/^\s*(pub(\([^)]*\))?\s+)?mod\s+\w+\s*\{/.test(lines[j])) {
					inTestCfg = true;
					depth = 1;
					i = j;
					break;
				}
				if (lines[j].trim() && !lines[j].trim().startsWith("//")) break;
			}
			continue;
		}
		if (inTestCfg) {
			for (const ch of line) {
				if (ch === "{") depth++;
				else if (ch === "}") {
					depth--;
					if (depth === 0) {
						inTestCfg = false;
						break;
					}
				}
			}
		}
	}
	return inTestCfg;
}

function isTestPath(line: string): boolean {
	const m = line.match(/^([^:]+):(\d+):/);
	if (!m) return false;
	const file = m[1];
	const lineNum = Number.parseInt(m[2], 10);
	if (file.includes("/tests/")) return true;
	const basename = file.split("/").pop() ?? file;
	if (/(?:^|_)tests?(?:_|\.|$)/.test(basename)) return true;
	return isInTestCfg(file, lineNum);
}

const rustPanic = splitByPragma(rgLines("panic!\\(", RUST_GLOB).filter((l) => !isTestPath(l)));
const rustUnwrap = splitByPragma(
	rgLines("\\.unwrap\\(\\)", RUST_GLOB).filter((l) => !isTestPath(l)),
);
const rustExpect = splitByPragma(rgLines("\\.expect\\(", RUST_GLOB).filter((l) => !isTestPath(l)));

function ctOf(split: PragmaSplit): {
	count: number;
	pragmaCount: number;
	sample: string[];
} {
	return {
		count: split.live.length,
		pragmaCount: split.pragma.length,
		sample: split.live.slice(0, 5),
	};
}

const report = {
	generatedAt: new Date().toISOString(),
	typescript: {
		castsOnCaughtError: ctOf(tsCastsOnError),
		recordStringUnknown: ctOf(tsRecordUnknown),
		unknownArray: ctOf(tsUnknownArr),
		envFallbackChain: ctOf(tsEnvFallback),
		jsonParseFallbackChain: ctOf(tsJsonParseFallback),
	},
	rust: {
		resultStringErr: ctOf(rustResultString),
		panicCalls: ctOf(rustPanic),
		unwrapCalls: ctOf(rustUnwrap),
		expectCalls: ctOf(rustExpect),
	},
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`boundary-types: ts {casts:${tsCastsOnError.live.length} record-unk:${tsRecordUnknown.live.length} unk-arr:${tsUnknownArr.live.length} env-??:${tsEnvFallback.live.length} parse-??:${tsJsonParseFallback.live.length}} rust {Result<,String>:${rustResultString.live.length} panic:${rustPanic.live.length} unwrap:${rustUnwrap.live.length} expect:${rustExpect.live.length}} pragma'd: ts ${
		tsCastsOnError.pragma.length +
		tsRecordUnknown.pragma.length +
		tsUnknownArr.pragma.length +
		tsEnvFallback.pragma.length +
		tsJsonParseFallback.pragma.length
	} rust ${
		rustResultString.pragma.length +
		rustPanic.pragma.length +
		rustUnwrap.pragma.length +
		rustExpect.pragma.length
	}`,
);

// Hardened gate: every category must be 0. Genuine pass-through must use
// `// audit-boundary: opaque-passthrough -- <reason>` directly above the
// match. Pragma'd sites are tracked separately and do not count toward
// the ceiling.
const current = {
	typescript: {
		castsOnCaughtError: tsCastsOnError.live.length,
		recordStringUnknown: tsRecordUnknown.live.length,
		unknownArray: tsUnknownArr.live.length,
		envFallbackChain: tsEnvFallback.live.length,
		jsonParseFallbackChain: tsJsonParseFallback.live.length,
	},
	rust: {
		resultStringErr: rustResultString.live.length,
		panicCalls: rustPanic.live.length,
		unwrapCalls: rustUnwrap.live.length,
		expectCalls: rustExpect.live.length,
	},
};

const violations: string[] = [];
for (const [k, v] of Object.entries(current.typescript)) {
	if (v > 0) violations.push(`typescript.${k}: ${v} (must be 0)`);
}
for (const [k, v] of Object.entries(current.rust)) {
	if (v > 0) violations.push(`rust.${k}: ${v} (must be 0)`);
}

if (violations.length > 0) {
	console.error(`boundary-types FAIL: ${violations.length} category/ies have weak-typed sites.`);
	for (const v of violations) console.error(`  ${v}`);
	console.error(
		"\nFix the new occurrence(s). Use packages/astropress/src/result.ts (Result/Option) at TS module boundaries, concrete error enums in Rust. Genuine pass-through can use `// audit-boundary: opaque-passthrough -- <reason>` (same line or above).",
	);
	process.exit(1);
}
