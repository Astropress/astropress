#!/usr/bin/env bun
/**
 * audit-route-http-matrix — coarse coverage matrix:
 *   for every admin route file → does ANY test reference it (Playwright,
 *   smoke, or vitest)? does any auth-redirect test exist for it?
 *
 * Doesn't claim per-method coverage (would require an LSP-grade walk).
 * Surfaces the routes that are entirely test-untouched and the routes
 * with no anon-auth test (no 302-to-login coverage).
 *
 * Discovery only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

const ADMIN_DIR = "packages/astropress/pages/ap-admin";
const TESTS = "packages/astropress/tests";
const E2E = "tooling/e2e";
const SMOKE = "tooling/scripts/run-consumer-smoke.ts";
const OUT = "tooling/audit-output/route-http-matrix.json";

function lines(cmd: string): string[] {
	try {
		return execFileSync("bash", ["-c", cmd], { encoding: "utf8" }).split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

const adminFiles = lines(`find ${ADMIN_DIR} -type f \\( -name "*.astro" -o -name "*.ts" \\)`).map(
	(p) => relative(ADMIN_DIR, p),
);

const testCorpus = lines(`find ${TESTS} ${E2E} -name '*.ts' 2>/dev/null`);
const smokeContent = (() => {
	try {
		return readFileSync(SMOKE, "utf8");
	} catch {
		return "";
	}
})();

function classify(file: string): {
	route: string;
	mentioned: boolean;
	mentionedInSmoke: boolean;
	hasAnonAuthTest: boolean;
} {
	const route = `/ap-admin/${file.replace(/\.(astro|ts)$/, "")}`;
	const routePrefix = route.replace(/\/\[[^\]]+\]/g, "");
	const matches = lines(`grep -lF "${routePrefix}" ${testCorpus.join(" ")} 2>/dev/null`);
	const mentionedInSmoke = smokeContent.includes(routePrefix);
	// Heuristic for anon-auth coverage: a test mentions both this route AND
	// "redirect" / "302" / "/login" / "anon".
	let hasAnonAuth = false;
	for (const m of matches) {
		const txt = readFileSync(m, "utf8");
		if (txt.includes(routePrefix) && /redirect|302|\/ap-admin\/login|anon/i.test(txt)) {
			hasAnonAuth = true;
			break;
		}
	}
	return {
		route,
		mentioned: matches.length > 0 || mentionedInSmoke,
		mentionedInSmoke,
		hasAnonAuthTest: hasAnonAuth,
	};
}

const rows = adminFiles.map(classify);
const untouched = rows.filter((r) => !r.mentioned);
const noAnonAuth = rows.filter((r) => !r.hasAnonAuthTest);

const report = {
	generatedAt: new Date().toISOString(),
	routeCount: rows.length,
	untouched: untouched.length,
	noAnonAuthTest: noAnonAuth.length,
	smokeCovered: rows.filter((r) => r.mentionedInSmoke).length,
	untouchedRoutes: untouched.map((r) => r.route),
	noAnonAuthTestRoutes: noAnonAuth.map((r) => r.route),
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
	`route-http-matrix: total=${rows.length} untouched=${untouched.length} no-anon-auth-test=${noAnonAuth.length} smoke-covered=${rows.filter((r) => r.mentionedInSmoke).length}`,
);

// Gate: every admin route must be referenced by at least one test file AND
// at least one test must pair it with an anon-redirect / login keyword.
// Why both: untouched=0 alone allows a route to be tested for a happy path
// while regressing the auth gate silently. The new admin-routes-auth-matrix
// test embeds every route prefix paired with /ap-admin/login, so any new
// route added without a paired test will surface here, not in prod.
if (untouched.length > 0 || noAnonAuth.length > 0) {
	console.error(
		`route-http-matrix FAIL: ${untouched.length} untouched, ${noAnonAuth.length} without anon-auth coverage.`,
	);
	for (const r of untouched) console.error(`  untouched: ${r.route}`);
	for (const r of noAnonAuth) console.error(`  no-anon-auth: ${r.route}`);
	console.error(
		"\nAdd the route prefix to packages/astropress/tests/admin-routes-auth-matrix.test.ts (paired with /ap-admin/login keyword) or write a dedicated test.",
	);
	process.exit(1);
}
