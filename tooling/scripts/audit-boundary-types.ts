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
 * Discovery + grandfather-baseline gate.
 */

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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
	rgLines(
		"\\(\\s*err\\s+as\\s+\\{|\\(\\s*error\\s+as\\s+\\{|\\(\\s*e\\s+as\\s+\\{",
		TS_GLOB,
	),
);
const tsRecordUnknown = splitByPragma(
	rgLines("Record<string,\\s*unknown>", TS_GLOB),
);
const tsUnknownArr = splitByPragma(rgLines(":\\s*unknown\\[\\]", TS_GLOB));
const tsEnvFallback = splitByPragma(
	rgLines("process\\.env\\.[A-Z_]+\\s*\\?\\?", TS_GLOB),
);
const tsJsonParseFallback = splitByPragma(
	rgLines("JSON\\.parse\\([^)]+\\)\\s*\\?\\?", TS_GLOB),
);

const rustResultString = splitByPragma(
	rgLines("\\bResult<.*,\\s*(String|&str)\\b", RUST_GLOB),
);
// Filter unwrap/expect/panic to lines NOT inside tests dir (cheap heuristic).
const rustPanic = splitByPragma(
	rgLines("panic!\\(", RUST_GLOB).filter((l) => !l.includes("/tests/")),
);
const rustUnwrap = splitByPragma(
	rgLines("\\.unwrap\\(\\)", RUST_GLOB).filter((l) => !l.includes("/tests/")),
);
const rustExpect = splitByPragma(
	rgLines("\\.expect\\(", RUST_GLOB).filter((l) => !l.includes("/tests/")),
);

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

// Gate via grandfathered baseline: counts may shrink but never grow. Same
// pattern as audit-suppressions — locks current weak-typed surface so new
// code can't add to the pile while incremental cleanup happens.
const BASELINE = "tooling/audit-output/boundary-types-baseline.json";
type BaselineShape = {
	typescript: Record<string, number>;
	rust: Record<string, number>;
};
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

if (process.argv.includes("--rewrite-baseline")) {
	writeFileSync(
		BASELINE,
		`${JSON.stringify(
			{
				updatedAt: new Date().toISOString().slice(0, 10),
				note: "Grandfathered ceilings — counts may decrease but never increase. Run --rewrite-baseline to ratchet down. Pragma'd opaque-passthrough sites are tracked separately and do not count toward the ceiling.",
				...current,
			},
			null,
			2,
		)}\n`,
	);
	console.log("boundary-types baseline rewritten.");
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as BaselineShape;
const violations: string[] = [];
for (const [k, v] of Object.entries(current.typescript)) {
	const ceiling = baseline.typescript[k] ?? 0;
	if (v > ceiling)
		violations.push(`typescript.${k}: ${v} > ceiling ${ceiling}`);
}
for (const [k, v] of Object.entries(current.rust)) {
	const ceiling = baseline.rust[k] ?? 0;
	if (v > ceiling) violations.push(`rust.${k}: ${v} > ceiling ${ceiling}`);
}

if (violations.length > 0) {
	console.error(
		`boundary-types FAIL: ${violations.length} category/ies exceed grandfathered ceiling.`,
	);
	for (const v of violations) console.error(`  ${v}`);
	console.error(
		"\nFix the new occurrence(s). Use packages/astropress/src/result.ts (Result/Option) at TS module boundaries, concrete error enums in Rust. Genuine pass-through can use `// audit-boundary: opaque-passthrough -- <reason>` (same line or above). Intentional refactor that lowers counts: bun run tooling/scripts/audit-boundary-types.ts --rewrite-baseline.",
	);
	process.exit(1);
}
