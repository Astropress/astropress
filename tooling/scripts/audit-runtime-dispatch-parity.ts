/**
 * audit-runtime-dispatch-parity.ts
 *
 * Forbids direct `loadLocalAdminStore()` usage under
 * `packages/astropress/pages/**`.
 *
 * Why: `src/local-runtime-modules.ts` throws by default and is stubbed to throw
 * on the Cloudflare build, so any route that calls `loadLocalAdminStore()`
 * directly breaks on hosts that provide a D1 binding but not the local-runtime
 * alias. The repo already has the D1/local dispatch seam — `withLocalStoreFallback`
 * / `resolveApiRuntime` in `src/admin-store-dispatch.ts` and the dispatch-aware
 * `*Runtime*` actions in `src/runtime-*.ts`. Routes must reach the store through
 * that seam so both host modes work. This is the class behind #137 (REST + admin
 * token/webhook surfaces hardwired to the local loader).
 *
 * Rule: ZERO references to `loadLocalAdminStore` in any `.ts`/`.astro` under
 * `pages/`. Use `resolveApiRuntime(locals)` for the apiTokens/webhooks/rate-limit
 * surface, or the dispatch-aware runtime actions (`getRuntime*`, `saveRuntime*`,
 * `createRuntime*`, `scheduleRuntimePublish`, …) for data.
 *
 * Exit 0 — no direct loader usage under pages/.
 * Exit 1 — one or more direct usages found (route them through the dispatch seam).
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const PAGES_ROOT = fromRoot("packages/astropress/pages");
const FORBIDDEN = "loadLocalAdminStore";

// Pages permitted to keep a direct loader call, each with a reason. Empty by
// design: every page+REST handler now routes through the dispatch seam. Adding
// an entry here is a deliberate, reviewed exception — not a place to park new
// debt.
const ALLOWLIST = new Map<string, string>();

async function main(): Promise<void> {
	const report = new AuditReport("runtime-dispatch-parity");

	const files = await listFiles(PAGES_ROOT, {
		recursive: true,
		extensions: [".ts", ".astro"],
	});

	for (const file of files) {
		const abs = `${PAGES_ROOT}/${file}`;
		const rel = relative(fromRoot(), abs);
		const src = await readText(abs);
		if (!src.includes(FORBIDDEN)) continue;
		if (ALLOWLIST.has(rel)) continue;
		report.add(
			`${rel}: direct ${FORBIDDEN}() bypasses the D1/local dispatch seam and breaks on ` +
				`D1-only hosts (#137). Use resolveApiRuntime(locals) or a dispatch-aware runtime action.`,
		);
	}

	report.finish(`✓ audit:runtime-dispatch-parity — no direct ${FORBIDDEN}() under pages/`);
}

runAudit("runtime-dispatch-parity", main);
