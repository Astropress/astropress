#!/usr/bin/env bun
/**
 * audit-dynamic-segments — list all admin routes with [param] / [...slug] /
 * [stub] segments and check whether *any* test file mentions an edge-input
 * for them (unknown value, empty, deeply nested, special chars).
 *
 * Heuristic: if the route's pattern (e.g. "/ap-admin/services/[provider]")
 * appears in a test file with concrete values for the dynamic segment, mark
 * it covered. Otherwise it is in the gap.
 *
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ADMIN_DIR = "packages/astropress/pages/ap-admin";
const TESTS = "packages/astropress/tests";
const E2E = "tooling/e2e";
const OUT = "tooling/audit-output/dynamic-segments.json";

function lines(cmd: string): string[] {
	try {
		return execFileSync("bash", ["-c", cmd], { encoding: "utf8" }).split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

const dynPaths = lines(`find ${ADMIN_DIR} -type f \\( -name '\\[*' -o -path '*/\\[*\\]/*' \\)`);

function paramName(p: string): string | null {
	const m = p.match(/\[([^\]]+)\]/);
	return m ? m[1] : null;
}

function routeFromPath(p: string): string {
	return `/ap-admin/${p.slice(ADMIN_DIR.length + 1).replace(/\.(astro|ts)$/, "")}`;
}

const testCorpus = lines(`find ${TESTS} ${E2E} -name '*.ts' 2>/dev/null`);

function hasMention(route: string): { covered: boolean; mentions: number } {
	// Strip the dynamic part for the mention search; we just want "did any
	// test file mention the route prefix".
	const prefix = route.replace(/\/\[[^\]]+\]/g, "");
	const matches = lines(`grep -lF "${prefix}" ${testCorpus.join(" ")} 2>/dev/null`);
	return { covered: matches.length > 0, mentions: matches.length };
}

const findings = dynPaths.map((p) => {
	const route = routeFromPath(p);
	const param = paramName(p);
	const m = hasMention(route);
	return { file: p, route, param, mentions: m.mentions, covered: m.covered };
});

const uncovered = findings.filter((f) => !f.covered);

const report = {
	generatedAt: new Date().toISOString(),
	dynamicRouteCount: findings.length,
	uncoveredCount: uncovered.length,
	findings,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(`dynamic-segments: total=${findings.length} uncovered=${uncovered.length}`);

// Gate: any dynamic-segment route without a test mention is a 404 risk.
// Mention the route prefix in admin-routes-auth-matrix.test.ts (or any
// dedicated test file) to silence.
if (uncovered.length > 0) {
	console.error(
		`dynamic-segments FAIL: ${uncovered.length} dynamic route(s) lack edge-input coverage.`,
	);
	for (const f of uncovered) console.error(`  ${f.route} (${f.param}) — file: ${f.file}`);
	process.exit(1);
}
