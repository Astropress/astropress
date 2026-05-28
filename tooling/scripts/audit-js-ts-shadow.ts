/**
 * audit-js-ts-shadow.ts
 *
 * Forbids committed `.js` route files under `packages/astropress/pages/**`.
 *
 * Why: Astro resolves a committed `pages/foo.js` ahead of (or duplicating) a
 * sibling `pages/foo.ts`/`pages/foo.astro`. A stale `.js` therefore silently
 * shadows the authored `.ts` — edits to the `.ts` become runtime no-ops while
 * tests (which resolve `.ts` via the vitest extensionAlias) still pass, hiding
 * the divergence. This exact split shipped the bugs behind #120 (metrics media
 * count), #124 (canonical origin in sitemap/robots/llms) and #139 (og-image).
 *
 * Rule: there must be ZERO `.js` files under `pages/`. All route handlers are
 * authored as `.ts`/`.astro`; the package ships source (see package.json
 * `files`) and the host app's Astro/Vite compiles them, exactly as it already
 * does for the `pages/ap-admin/*.astro` surface and the `.ts` entrypoints in
 * `api-routes-data.ts` / `admin-routes-definitions.ts`.
 *
 * Exit 0 — no committed `.js` under pages/.
 * Exit 1 — one or more `.js` files found (must be deleted or rewritten as .ts).
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, runAudit } from "../lib/audit-utils.js";

const PAGES_ROOT = fromRoot("packages/astropress/pages");

async function main(): Promise<void> {
	const report = new AuditReport("js-ts-shadow");

	const jsFiles = await listFiles(PAGES_ROOT, { recursive: true, extensions: [".js"] });
	for (const file of jsFiles) {
		const rel = relative(fromRoot(), `${PAGES_ROOT}/${file}`);
		report.add(
			`${rel}: committed .js under pages/ shadows the authored .ts/.astro at runtime. ` +
				`Delete it (route handlers are authored as .ts/.astro).`,
		);
	}

	report.finish(`✓ audit:js-ts-shadow — no committed .js shadows under pages/`);
}

runAudit("js-ts-shadow", main);
