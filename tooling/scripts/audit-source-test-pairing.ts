#!/usr/bin/env bun
/**
 * audit-source-test-pairing — list src files with no test companion and
 * test files whose target src no longer exists. Covers TS (packages/astropress)
 * and Rust (crates/astropress-cli).
 *
 * "Companion" heuristic: test file name (without .test.ts) appears as basename
 * of any src .ts file (recursive). For Rust, src basename appears in any
 * `tests/` directory file or as an inline `#[cfg(test)]` block within the
 * file itself.
 *
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

const OUT = "tooling/audit-output/source-test-pairing.json";

function lines(cmd: string): string[] {
	try {
		return execFileSync("bash", ["-c", cmd], { encoding: "utf8" })
			.split("\n")
			.filter(Boolean);
	} catch {
		return [];
	}
}

function tsAudit(): {
	srcCount: number;
	testCount: number;
	unpairedSrc: string[];
	orphanTests: string[];
} {
	const SRC = "packages/astropress/src";
	const TESTS = "packages/astropress/tests";

	const srcFiles = lines(
		`find ${SRC} -name "*.ts" -not -name "*.d.ts" -not -name "index.ts" -not -name "*-types.ts"`,
	);
	const testFiles = lines(`find ${TESTS} -name "*.test.ts"`);

	// Build a lookup of every "name token" reachable from a test file path:
	//   tests/access-action-registry.test.ts → "access-action-registry", "action-registry", "access"
	//   tests/sqlite-runtime/audit-log.test.ts → "audit-log", "sqlite-runtime/audit-log"
	//   tests/appwrite-adapter.test.ts → "appwrite-adapter", "adapter", "appwrite"
	const testTokens = new Set<string>();
	for (const t of testFiles) {
		const base = basename(t, ".test.ts");
		testTokens.add(base);
		const parts = base.split("-");
		// Tail tokens (drop one prefix at a time): "a-b-c" → "b-c", "c"
		for (let i = 1; i < parts.length; i++) {
			testTokens.add(parts.slice(i).join("-"));
		}
		// Head tokens (drop one suffix at a time): "a-b-c" → "a-b", "a"
		// Lets `appwrite-adapter.test.ts` pair with `src/adapters/appwrite.ts`.
		for (let i = parts.length - 1; i >= 1; i--) {
			testTokens.add(parts.slice(0, i).join("-"));
		}
		// Subdir relative to TESTS dir.
		const rel = t.slice(TESTS.length + 1);
		testTokens.add(rel.replace(/\.test\.ts$/, ""));
	}

	// Also collect subdir prefixes from test names: a test named
	// `deploy-targets.test.ts` covers anything under `src/deploy/` for pairing
	// purposes (this codebase puts category-level tests at the test root with
	// the subdir as the leading hyphen-segment).
	const testSubdirPrefixes = new Set<string>();
	for (const t of testFiles) {
		const base = basename(t, ".test.ts");
		const head = base.split("-")[0];
		if (head) testSubdirPrefixes.add(head);
		// Subdir from path: tests/sqlite-runtime/*.test.ts → "sqlite-runtime".
		const rel = t.slice(TESTS.length + 1);
		if (rel.includes("/")) testSubdirPrefixes.add(rel.split("/")[0]);
	}

	// For each src file, generate candidate keys and probe testTokens.
	// Try all hyphen-substrings (head-trim + tail-trim) plus relative-path
	// variants and the common-suffix-stripped form. Also accept a subdir-level
	// match: src `deploy/custom.ts` is paired by any `tests/deploy-*.test.ts`.
	const unpairedSrc = srcFiles
		.filter((p) => {
			const base = basename(p, ".ts");
			const rel = p.slice(SRC.length + 1).replace(/\.ts$/, "");
			const candidates = new Set<string>([
				base,
				rel,
				rel.replace(/\//g, "-"),
				base.replace(/-helpers$|-utils$|-factory$|-impl$|-commons$/, ""),
			]);
			const parts = base.split("-");
			for (let i = 1; i < parts.length; i++)
				candidates.add(parts.slice(i).join("-"));
			for (let i = parts.length - 1; i >= 1; i--)
				candidates.add(parts.slice(0, i).join("-"));
			if ([...candidates].some((c) => testTokens.has(c))) return false;
			const subdir = rel.includes("/") ? rel.split("/")[0] : null;
			if (subdir && testSubdirPrefixes.has(subdir)) return false;
			return true;
		})
		.sort();

	// Orphan tests: any test whose basename doesn't map to ANY src basename
	// (including with prefixes stripped).
	const srcKeys = new Set<string>();
	for (const s of srcFiles) {
		const base = basename(s, ".ts");
		const rel = s.slice(SRC.length + 1).replace(/\.ts$/, "");
		srcKeys.add(base);
		srcKeys.add(rel);
		srcKeys.add(rel.replace(/\//g, "-"));
	}
	const orphanTests = testFiles
		.filter((p) => {
			const base = basename(p, ".test.ts");
			if (srcKeys.has(base)) return false;
			const parts = base.split("-");
			// Tail-trim: "access-foo" → matches "foo" src.
			for (let i = 1; i < parts.length; i++) {
				if (srcKeys.has(parts.slice(i).join("-"))) return false;
			}
			// Head-trim: "appwrite-adapter" → matches "appwrite" src.
			for (let i = parts.length - 1; i >= 1; i--) {
				if (srcKeys.has(parts.slice(0, i).join("-"))) return false;
			}
			return true;
		})
		.sort();

	return {
		srcCount: srcFiles.length,
		testCount: testFiles.length,
		unpairedSrc,
		orphanTests,
	};
}

function rustAudit(): {
	srcCount: number;
	unpaired: string[];
	intestSrc: number;
} {
	const SRC = "crates/astropress-cli/src";
	const srcFiles = lines(`find ${SRC} -name "*.rs" -not -name "main.rs"`);
	const integTests = new Set(
		lines("find crates/astropress-cli/tests -name '*.rs' 2>/dev/null").map(
			(p) => basename(p, ".rs"),
		),
	);
	const unpaired: string[] = [];
	let intestSrc = 0;
	for (const p of srcFiles) {
		const base = basename(p, ".rs");
		if (integTests.has(base)) continue;
		const content = (() => {
			try {
				return readFileSync(p, "utf8");
			} catch {
				return "";
			}
		})();
		if (content.includes("#[cfg(test)]")) {
			intestSrc++;
			continue;
		}
		// Skip dirs that are obviously plumbing.
		if (p.endsWith("mod.rs")) continue;
		if (p.endsWith("lib.rs")) continue;
		unpaired.push(p);
	}
	return { srcCount: srcFiles.length, unpaired: unpaired.sort(), intestSrc };
}

const ts = tsAudit();
const rust = rustAudit();

const report = {
	generatedAt: new Date().toISOString(),
	typescript: {
		srcCount: ts.srcCount,
		testCount: ts.testCount,
		unpairedSrcCount: ts.unpairedSrc.length,
		orphanTestCount: ts.orphanTests.length,
		unpairedSrc: ts.unpairedSrc,
		orphanTests: ts.orphanTests,
	},
	rust: {
		srcCount: rust.srcCount,
		intestSrcCount: rust.intestSrc,
		unpairedSrcCount: rust.unpaired.length,
		unpairedSrc: rust.unpaired,
	},
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`source-test-pairing: ts unpaired=${ts.unpairedSrc.length} orphan=${ts.orphanTests.length}; rust unpaired=${rust.unpaired.length}/${rust.srcCount} (inline-tested=${rust.intestSrc})`,
);

// Grandfather ratchet — same pattern as audit-boundary-types. Counts can
// fall over time, never rise. New src files MUST land with a companion
// test (or an audit-followup marker if the pairing is genuinely intentional).
const BASELINE = "tooling/audit-output/source-test-pairing-baseline.json";
type STBaseline = {
	typescript: { unpairedSrcCount: number; orphanTestCount: number };
	rust: { unpairedSrcCount: number };
};
const current: STBaseline = {
	typescript: {
		unpairedSrcCount: ts.unpairedSrc.length,
		orphanTestCount: ts.orphanTests.length,
	},
	rust: { unpairedSrcCount: rust.unpaired.length },
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
	console.log("source-test-pairing baseline rewritten.");
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as STBaseline;
const violations: string[] = [];
if (current.typescript.unpairedSrcCount > baseline.typescript.unpairedSrcCount)
	violations.push(
		`ts.unpairedSrc: ${current.typescript.unpairedSrcCount} > ceiling ${baseline.typescript.unpairedSrcCount}`,
	);
if (current.typescript.orphanTestCount > baseline.typescript.orphanTestCount)
	violations.push(
		`ts.orphanTest: ${current.typescript.orphanTestCount} > ceiling ${baseline.typescript.orphanTestCount}`,
	);
if (current.rust.unpairedSrcCount > baseline.rust.unpairedSrcCount)
	violations.push(
		`rust.unpairedSrc: ${current.rust.unpairedSrcCount} > ceiling ${baseline.rust.unpairedSrcCount}`,
	);

if (violations.length > 0) {
	console.error(
		`source-test-pairing FAIL: ${violations.length} category/ies exceed grandfathered ceiling.`,
	);
	for (const v of violations) console.error(`  ${v}`);
	console.error(
		"\nFix: pair the new src file with a *.test.ts companion (TS) or add #[cfg(test)] / tests/ companion (Rust). Intentional refactor that lowers counts: bun run tooling/scripts/audit-source-test-pairing.ts --rewrite-baseline.",
	);
	process.exit(1);
}
