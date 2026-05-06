#!/usr/bin/env bun
/**
 * run-discovery-audit — execute every audit-*.ts that produces a
 * tooling/audit-output/<name>.json artifact, then write a single SUMMARY.md
 * with headline counts. Used to feed the follow-up sweeping-fix plan.
 *
 * Re-runnable; reads only from filesystem and prior baseline JSONs.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SCRIPTS = [
	"tooling/scripts/audit-admin-route-drift.ts",
	"tooling/scripts/audit-astro-build-gap.ts",
	"tooling/scripts/audit-route-http-matrix.ts",
	"tooling/scripts/audit-dynamic-segments.ts",
	"tooling/scripts/audit-admin-label-coverage.ts",
	"tooling/scripts/audit-mutation-blindspots.ts",
	"tooling/scripts/audit-v8-coverage-scope.ts",
	"tooling/scripts/audit-source-test-pairing.ts",
	"tooling/scripts/audit-schema-migration-robustness.ts",
	"tooling/scripts/audit-boundary-types.ts",
];

if (!existsSync("tooling/audit-output")) {
	mkdirSync("tooling/audit-output", { recursive: true });
}

for (const s of SCRIPTS) {
	console.log(`\n── ${s}`);
	execFileSync("bun", ["run", s], { stdio: "inherit" });
}

// Compose SUMMARY.md from each artifact.
function read<T>(path: string): T | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return null;
	}
}

const ART = "tooling/audit-output";
const drift = read<any>(`${ART}/route-drift.json`);
const astro = read<any>(`${ART}/astro-build-gap.json`);
const matrix = read<any>(`${ART}/route-http-matrix.json`);
const dyn = read<any>(`${ART}/dynamic-segments.json`);
const labels = read<any>(`${ART}/admin-label-coverage.json`);
const mut = read<any>(`${ART}/mutation-blindspots.json`);
const v8 = read<any>(`${ART}/v8-coverage-scope.json`);
const pair = read<any>(`${ART}/source-test-pairing.json`);
const schema = read<any>(`${ART}/schema-migration-robustness.json`);
const types = read<any>(`${ART}/boundary-types.json`);

const lines = [
	"# Discovery audit — quality gap inventory",
	"",
	`Generated: ${new Date().toISOString()}`,
	"",
	"Each row links to the JSON artifact with the full file list. The follow-up sweeping-fix plan consumes these artifacts directly.",
	"",
	"| # | Workstream | Headline | Artifact |",
	"|---|---|---|---|",
	`| W1 | Admin route registry drift | ${drift?.unregistered ?? "?"} unregistered entrypoints, ${drift?.unbacked ?? "?"} unbacked registry entries | [route-drift.json](./route-drift.json) |`,
	`| W2 | Astro check gap | ${astro?.uncheckedAstro ?? "?"}/${astro?.totalAstro ?? "?"} \`.astro\` files have no astro-check (framework pages = ${astro?.frameworkPagesAstroCount ?? "?"}, components = ${astro?.frameworkComponentsAstroCount ?? "?"}) | [astro-build-gap.json](./astro-build-gap.json) |`,
	`| W3 | Route × auth coverage | ${matrix?.untouched ?? "?"}/${matrix?.routeCount ?? "?"} routes test-untouched; ${matrix?.noAnonAuthTest ?? "?"} have no anon-auth/redirect test; smoke covers ${matrix?.smokeCovered ?? "?"} | [route-http-matrix.json](./route-http-matrix.json) |`,
	`| W4 | Dynamic-segment edge cases | ${dyn?.uncoveredCount ?? "?"}/${dyn?.dynamicRouteCount ?? "?"} dynamic routes never mentioned in tests | [dynamic-segments.json](./dynamic-segments.json) |`,
	`| W5 | Admin label coverage | ${labels?.deadLabelKeys?.length ?? "?"}/${labels?.definedKeyCount ?? "?"} label keys are dead (defined, never read); ${labels?.dynamicCallSiteCount ?? "?"} dynamic call sites | [admin-label-coverage.json](./admin-label-coverage.json) |`,
	`| W6 | Mutation blind spots | ignoreStatic=${mut?.strykerConfig?.ignoreStatic}; ${mut?.baselineDistribution?.lt80 ?? "?"} files <80%, ${mut?.baselineDistribution?.lt90 ?? "?"} [80,90), ${mut?.baselineDistribution?.lt95 ?? "?"} [90,95); ${mut?.highFanoutAllowlistCount ?? "?"} high-fanout tests on allowlist | [mutation-blindspots.json](./mutation-blindspots.json) |`,
	`| W7 | v8 coverage scope | only ${v8?.coverageIncludedCount ?? "?"} files in vitest \`coverage.include\`; ${v8?.baselineNotInCoverageIncludeCount ?? "?"}/${v8?.baselineTrackedCount ?? "?"} baseline-tracked files unmeasured by v8; ${v8?.falseConfidenceCount ?? "?"} files mutation-passing ≥95 with no v8 line/branch threshold | [v8-coverage-scope.json](./v8-coverage-scope.json) |`,
	`| W8 | Source-test pairing | TS: ${pair?.typescript?.unpairedSrcCount ?? "?"} unpaired src / ${pair?.typescript?.orphanTestCount ?? "?"} orphan tests (heuristic, includes false positives from path-flattened naming). Rust: ${pair?.rust?.unpairedSrcCount ?? "?"}/${pair?.rust?.srcCount ?? "?"} unpaired (${pair?.rust?.intestSrcCount ?? "?"} are inline-tested) | [source-test-pairing.json](./source-test-pairing.json) |`,
	`| W9 | Schema/migration robustness | SQLite has ${schema?.sqliteTableCount ?? "?"} tables, D1 path declares ${schema?.d1TableCount ?? "?"} (only \`schema_migrations\`); ${schema?.tablesOnlyInSqlite?.length ?? "?"} tables have no D1 mirror. Host migration dir absent — \`.down.sql\` companion check N/A | [schema-migration-robustness.json](./schema-migration-robustness.json) |`,
	`| W10 | Boundary type safety | TS: ${types?.typescript?.recordStringUnknown?.count ?? "?"} \`Record<string,unknown>\`, ${types?.typescript?.unknownArray?.count ?? "?"} \`unknown[]\`, ${types?.typescript?.castsOnCaughtError?.count ?? "?"} caught-error casts. Rust: ${types?.rust?.resultStringErr?.count ?? "?"} \`Result<T,String>\`, ${types?.rust?.panicCalls?.count ?? "?"} panic, ${types?.rust?.unwrapCalls?.count ?? "?"} unwrap, ${types?.rust?.expectCalls?.count ?? "?"} expect (outside \`tests/\`) | [boundary-types.json](./boundary-types.json) |`,
	"",
	"## Top architectural smells (cross-cutting)",
	"",
	"1. **D1 schema is undocumented and unsynced** — host apps deploy 36 tables manually with no parity check or migration runner that mirrors SQLite. Every new sqlite-schema column is a silent D1 production-drift bomb.",
	"2. **Framework pages are unchecked** — `astro check` runs on docs (3 files) and the harness (3 files); the 73 framework `.astro` files compile only when a downstream consumer builds. Recent 404 regression matches this gap.",
	"3. **Mutation gate's blind side** — `ignoreStatic: true` silently drops mutants on top-level constants (e.g. cookie names, label literals). 91 baseline files are below 80% and the floor never sweeps them; combined with v8 coverage covering only 23 files, ~140 files are mutation-passing-without-line-coverage.",
	"4. **Action handlers untested for auth** — 24/102 admin route files have no test mention; 25/102 have no anon/redirect test. Most are `actions/*.ts` POST endpoints — write-path access control is not behaviourally verified.",
	"5. **Stringly-typed errors at boundaries** — Rust returns `Result<T, String>` in 84 places; TS uses `Record<string, unknown>` in 96 exported signatures. Every consumer must guess the error/payload shape; no compiler help on misuse.",
	"6. **Dead-weight labels & fan-out tests** — 80 of 115 admin labels are unused (carry-cost on every translator); 10 tests stay on the high-fanout allowlist (each is ~minutes of cache invalidation per edit).",
	"",
	"## Next plan trigger",
	"",
	"Consume each JSON artifact in a follow-up sweeping-fix plan: W1 → register-or-delete; W2 → wire `astro check`; W3/W4 → write missing route tests; W5 → delete dead labels; W6 → flip ignoreStatic OFF for a per-file sweep, raise floor; W7 → broaden vitest `coverage.include`; W8 → split orphan tests, add companions; W9 → ship a D1 schema mirror + parity test; W10 → introduce error enums (Rust) and shape types (TS) at boundaries.",
	"",
];

// Only rewrite SUMMARY.md when explicitly asked. The aggregator runs in
// pre-push slow-audits as a hard gate, but rewriting SUMMARY.md every push
// dirties the worktree and trips repo:clean. Pass --write-summary for
// manual / scheduled runs that should refresh the snapshot.
if (process.argv.includes("--write-summary")) {
	writeFileSync("tooling/audit-output/SUMMARY.md", `${lines.join("\n")}\n`);
	console.log("\n→ tooling/audit-output/SUMMARY.md");
} else {
	console.log("\n(skipping SUMMARY.md write; pass --write-summary to refresh)");
}
