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
		castsOnCaughtError: tsCastsOnError.length,
		recordStringUnknown: tsRecordUnknown.length,
		unknownArray: tsUnknownArr.length,
		envFallbackChain: tsEnvFallback.length,
		jsonParseFallbackChain: tsJsonParseFallback.length,
	},
	rust: {
		resultStringErr: rustResultString.length,
		panicCalls: rustPanic.length,
		unwrapCalls: rustUnwrap.length,
		expectCalls: rustExpect.length,
	},
};

if (process.argv.includes("--rewrite-baseline")) {
	writeFileSync(
		BASELINE,
		`${JSON.stringify(
			{
				updatedAt: new Date().toISOString().slice(0, 10),
				note: "Grandfathered ceilings — counts may decrease but never increase. Run --rewrite-baseline to ratchet down.",
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
		"\nFix the new occurrence(s). Use packages/astropress/src/result.ts (Result/Option) at TS module boundaries, concrete error enums in Rust. Intentional refactor that lowers counts: bun run tooling/scripts/audit-boundary-types.ts --rewrite-baseline.",
	);
	process.exit(1);
}
