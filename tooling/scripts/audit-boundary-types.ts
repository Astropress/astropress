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
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

const tsCastsOnError = rgLines(
	"\\(\\s*err\\s+as\\s+\\{|\\(\\s*error\\s+as\\s+\\{|\\(\\s*e\\s+as\\s+\\{",
	TS_GLOB,
);
const tsRecordUnknown = rgLines("Record<string,\\s*unknown>", TS_GLOB);
const tsUnknownArr = rgLines(":\\s*unknown\\[\\]", TS_GLOB);
const tsEnvFallback = rgLines("process\\.env\\.[A-Z_]+\\s*\\?\\?", TS_GLOB);
const tsJsonParseFallback = rgLines(
	"JSON\\.parse\\([^)]+\\)\\s*\\?\\?",
	TS_GLOB,
);

const rustResultString = rgLines("Result<.*,\\s*(String|&str)\\b", RUST_GLOB);
// Filter unwrap/expect/panic to lines NOT inside tests dir (cheap heuristic).
const rustPanic = rgLines("panic!\\(", RUST_GLOB).filter(
	(l) => !l.includes("/tests/"),
);
const rustUnwrap = rgLines("\\.unwrap\\(\\)", RUST_GLOB).filter(
	(l) => !l.includes("/tests/"),
);
const rustExpect = rgLines("\\.expect\\(", RUST_GLOB).filter(
	(l) => !l.includes("/tests/"),
);

// Drop hits inside #[cfg(test)] modules (file-line heuristic skipped — emit raw count).
function ctOf(arr: string[]): { count: number; sample: string[] } {
	return { count: arr.length, sample: arr.slice(0, 5) };
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
	`boundary-types: ts {casts:${tsCastsOnError.length} record-unk:${tsRecordUnknown.length} unk-arr:${tsUnknownArr.length} env-??:${tsEnvFallback.length} parse-??:${tsJsonParseFallback.length}} rust {Result<,String>:${rustResultString.length} panic:${rustPanic.length} unwrap:${rustUnwrap.length} expect:${rustExpect.length}}`,
);
