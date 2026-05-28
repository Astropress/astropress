/**
 * audit-abac-enforcement-parity.ts
 *
 * The ABAC class (#101/#104/#106/#110/#114/#121/#125/#135) is a string of
 * authorization gaps: admin action routes that ran with only session+CSRF (no
 * authorization), or gated on the coarse `requireAdmin` break-glass instead of
 * their declared fine-grained permission; and admin listing pages that rendered
 * data with no `requiresAccess` guard at all. This audit fails if either
 * recurs.
 *
 * Rules:
 *  1. Every action route under `pages/ap-admin/actions/**` must pass a
 *     `requireAction: "<perm>"` to its guard — except the reviewed pre-session
 *     flows (token consumption before a session exists). `requireAdmin` is no
 *     longer an acceptable substitute for the declared permission.
 *  2. Every `requireAction` value must be a real action in
 *     `src/access/action-registry-data.ts` (no typo'd / dangling permissions).
 *  3. The admin listing/hub pages that were previously unguarded must keep their
 *     `requiresAccess(...)` page guard (locks in #104/#106/#125/#135).
 *
 * Exit 0 — actions and the guarded pages are all in parity. Exit 1 — a gap
 * reappeared.
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const ACTIONS_ROOT = fromRoot("packages/astropress/pages/ap-admin/actions");
const ADMIN_PAGES_ROOT = fromRoot("packages/astropress/pages/ap-admin");
const REGISTRY_DATA = fromRoot("packages/astropress/src/access/action-registry-data.ts");

/**
 * Action routes legitimately without `requireAction`: they run BEFORE a session
 * exists and authenticate via a single-use token instead. Keep this list tiny
 * and reasoned — it is the only sanctioned bypass of rule (1).
 */
const PRE_SESSION_ACTIONS: ReadonlyMap<string, string> = new Map([
	["accept-invite.ts", "consumes a single-use invite token before any session exists"],
	["reset-password.ts", "consumes a single-use reset token before any session exists"],
]);

/** Page → required action guard. Locks in the #104/#106/#125/#135 page fixes. */
const REQUIRED_PAGE_GUARDS: readonly [string, string][] = [
	["media.astro", "media:list"],
	["posts.astro", "posts:list"],
	["comments.astro", "comments:moderate"],
	["services.astro", "services:manage"],
	["testimonials.astro", "testimonials:manage"],
	["fundraising.astro", "fundraising:manage"],
	["analytics.astro", "services:manage"],
	["search.astro", "services:manage"],
];

function registeredActions(src: string): Set<string> {
	const out = new Set<string>();
	for (const m of src.matchAll(/"([a-zA-Z]+:[a-zA-Z]+)"/g)) out.add(m[1]);
	return out;
}

async function main(): Promise<void> {
	const report = new AuditReport("abac-enforcement-parity");
	const actions = registeredActions(await readText(REGISTRY_DATA));

	const actionFiles = await listFiles(ACTIONS_ROOT, { extensions: [".ts"] });
	for (const file of actionFiles) {
		const src = await readText(`${ACTIONS_ROOT}/${file}`);
		const declared = [...src.matchAll(/requireAction:\s*"([^"]+)"/g)].map((m) => m[1]);

		if (declared.length === 0) {
			if (PRE_SESSION_ACTIONS.has(file)) continue;
			report.add(
				`pages/ap-admin/actions/${file}: action route has no requireAction guard. Any ` +
					`authenticated subject could invoke it. Pass requireAction: "<perm>" to ` +
					`withAdminFormAction/requireAdminFormAction (#101/#110/#114/#121).`,
			);
			continue;
		}
		if (PRE_SESSION_ACTIONS.has(file)) {
			report.add(
				`pages/ap-admin/actions/${file}: listed as pre-session yet declares requireAction — ` +
					`remove it from PRE_SESSION_ACTIONS in this audit.`,
			);
		}
		for (const action of declared) {
			if (!actions.has(action)) {
				report.add(
					`pages/ap-admin/actions/${file}: requireAction "${action}" is not a registered ` +
						`action in action-registry-data.ts (typo or missing registration).`,
				);
			}
		}
	}

	for (const [page, action] of REQUIRED_PAGE_GUARDS) {
		const abs = `${ADMIN_PAGES_ROOT}/${page}`;
		const src = await readText(abs);
		const rel = relative(fromRoot(), abs);
		if (!src.includes(`requiresAccess(Astro, "${action}")`)) {
			report.add(
				`${rel}: must guard on requiresAccess(Astro, "${action}") so the page enforces the ` +
					`same rule as its actions/API; an unguarded listing page leaks data to any ` +
					`authenticated subject (#104/#106/#125/#135).`,
			);
		}
	}

	report.finish("✓ audit:abac-enforcement-parity — action routes + guarded pages are in parity");
}

runAudit("abac-enforcement-parity", main);
