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
	//   tests/access-action-registry.test.ts → "access-action-registry", "action-registry"
	//   tests/sqlite-runtime/audit-log.test.ts → "audit-log", "sqlite-runtime/audit-log"
	const testTokens = new Set<string>();
	for (const t of testFiles) {
		const base = basename(t, ".test.ts");
		testTokens.add(base);
		// Hyphen-segmented name: also add tail tokens (drop one prefix at a time).
		const parts = base.split("-");
		for (let i = 1; i < parts.length; i++) {
			testTokens.add(parts.slice(i).join("-"));
		}
		// Subdir relative to TESTS dir.
		const rel = t.slice(TESTS.length + 1);
		testTokens.add(rel.replace(/\.test\.ts$/, ""));
	}

	// For each src file, generate candidate keys and probe testTokens.
	const unpairedSrc = srcFiles
		.filter((p) => {
			const base = basename(p, ".ts");
			const rel = p.slice(SRC.length + 1).replace(/\.ts$/, "");
			const candidates = [
				base,
				rel,
				rel.replace(/\//g, "-"),
				base.replace(/-helpers$|-utils$|-factory$|-impl$|-commons$/, ""),
			];
			return !candidates.some((c) => testTokens.has(c));
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
			// Also tolerate tail-trim: "access-foo" → matches "foo" src.
			const parts = base.split("-");
			for (let i = 1; i < parts.length; i++) {
				if (srcKeys.has(parts.slice(i).join("-"))) return false;
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
