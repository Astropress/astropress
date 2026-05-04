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
	// "Integration" tests live at crates/astropress-cli/tests/ AND
	// crates/astropress-cli/src/tests/ (the latter via `#[cfg(test)] mod tests;`).
	const testFilePaths = [
		...lines("find crates/astropress-cli/tests -name '*.rs' 2>/dev/null"),
		...lines("find crates/astropress-cli/src/tests -name '*.rs' 2>/dev/null"),
	];
	// Build expanded test-name token set: include hyphen/underscore-separated
	// head- and tail-trims so `tests/parse_more.rs` covers any src whose
	// basename is "parse" (and vice versa).
	const integTests = new Set<string>();
	for (const p of testFilePaths) {
		const base = basename(p, ".rs");
		integTests.add(base);
		const parts = base.split("_");
		for (let i = 1; i < parts.length; i++)
			integTests.add(parts.slice(i).join("_"));
		for (let i = parts.length - 1; i >= 1; i--)
			integTests.add(parts.slice(0, i).join("_"));
	}
	const fileContent = new Map<string, string>();
	for (const p of srcFiles) {
		try {
			fileContent.set(p, readFileSync(p, "utf8"));
		} catch {
			fileContent.set(p, "");
		}
	}
	// Test-helper files are themselves tests, not src needing pairing.
	// Detected by: living under src/tests/, ending in *_tests*.rs / *_test.rs,
	// or being referenced by another file via `#[cfg(test)] #[path = "X"] mod ...`.
	const testHelperFiles = new Set<string>();
	for (const p of srcFiles) {
		if (p.includes("/tests/")) testHelperFiles.add(p);
		const base = basename(p, ".rs");
		if (/(_tests?|_tests_\w+)$/.test(base)) testHelperFiles.add(p);
	}
	// Collect #[cfg(test)] #[path = "X.rs"] references — the referenced file is
	// a test helper for the referencing file (and thus paired).
	const cfgTestPathPair = new Map<string, string>(); // referenced-file -> referencer
	for (const [p, content] of fileContent) {
		const re = /#\[cfg\(test\)\][^\n]*\n[^\n]*#\[path\s*=\s*"([^"]+)"\]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			const referenced = `${dirname(p)}/${m[1]}`.replace(/\/\.\//g, "/");
			cfgTestPathPair.set(referenced, p);
			testHelperFiles.add(referenced);
		}
	}

	// Sibling-file pairing: src/foo.rs paired by a sibling src/foo_tests.rs
	// (or foo_test.rs / foo_tests_more.rs etc).
	const siblingPaired = new Set<string>();
	for (const p of srcFiles) {
		const base = basename(p, ".rs");
		const dir = dirname(p);
		const sibPattern = new RegExp(`^${base}(?:_tests?(?:_\\w+)?|_tests)$`);
		for (const q of srcFiles) {
			if (q === p) continue;
			if (dirname(q) !== dir) continue;
			if (sibPattern.test(basename(q, ".rs"))) {
				siblingPaired.add(p);
				break;
			}
		}
	}

	// Use-statement coverage: parse `use <a::b::c>` from every test file and
	// resolve to a src path. This catches integration tests that don't share a
	// basename with the src they exercise (e.g. `tests/parse.rs` testing
	// `cli_config/args.rs`).
	const usePaired = new Set<string>();
	for (const p of testFilePaths) {
		const content = (() => {
			try {
				return readFileSync(p, "utf8");
			} catch {
				return "";
			}
		})();
		const useRe = /use\s+(?:crate::|super::)?([\w:]+)/g;
		let m: RegExpExecArray | null;
		while ((m = useRe.exec(content)) !== null) {
			const segments = m[1].split("::").filter((s) => s && s !== "self");
			// Check progressively shorter prefixes — cli_config::args::auth → try
			// auth.rs, then args.rs, then cli_config.rs.
			for (let i = segments.length; i > 0; i--) {
				const sub = segments.slice(0, i);
				const candidates = [
					`${SRC}/${sub.join("/")}.rs`,
					`${SRC}/${sub.join("/")}/mod.rs`,
				];
				for (const c of candidates) {
					if (fileContent.has(c)) usePaired.add(c);
				}
			}
		}
	}

	const unpaired: string[] = [];
	let intestSrc = 0;
	for (const p of srcFiles) {
		// Test-helper files don't themselves need a test partner.
		if (testHelperFiles.has(p)) continue;
		if (usePaired.has(p)) {
			intestSrc++;
			continue;
		}
		const base = basename(p, ".rs");
		// Direct + underscore-trim probe so `tests/import_wordpress_types.rs`
		// covers `commands/import_wordpress_types.rs` AND any sibling
		// `import_wordpress.rs` / `import.rs`.
		const candidates = new Set<string>([base]);
		const parts = base.split("_");
		for (let i = 1; i < parts.length; i++)
			candidates.add(parts.slice(i).join("_"));
		for (let i = parts.length - 1; i >= 1; i--)
			candidates.add(parts.slice(0, i).join("_"));
		if ([...candidates].some((c) => integTests.has(c))) continue;
		const content = fileContent.get(p) ?? "";
		if (content.includes("#[cfg(test)]")) {
			intestSrc++;
			continue;
		}
		if (siblingPaired.has(p)) {
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
