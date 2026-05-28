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
import {
	NAV_ACTION_BY_HREF,
	NAV_ACTION_MAP,
} from "../../packages/astropress/src/access/nav-action-map-data.js";
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

/**
 * Nav hrefs whose destination page MUST keep an explicit `requiresAccess(...)`
 * guard. The expected ACTION is not hardcoded here — it is derived from
 * `NAV_ACTION_MAP` (the same source AdminLayout filters its sidebar with), so
 * nav and page-guard can never drift. Locks in the #104/#106/#125/#135 fixes.
 */
const NAV_PAGES_REQUIRING_GUARD: readonly string[] = [
	"/ap-admin/media",
	"/ap-admin/posts",
	"/ap-admin/comments",
	"/ap-admin/testimonials",
	"/ap-admin/fundraising",
];

/**
 * Guarded admin pages that have no core nav leaf of their own (so they carry no
 * NAV_ACTION_MAP entry) but must still keep their `requiresAccess(...)` guard.
 */
const NON_NAV_GUARDED_PAGES: readonly [string, string][] = [
	["services.astro", "services:manage"],
	["analytics.astro", "services:manage"],
	["search.astro", "services:manage"],
];

/** page basename → required action, derived from NAV_ACTION_MAP + the non-nav supplement. */
function requiredPageGuards(): [string, string][] {
	const out: [string, string][] = [];
	for (const href of NAV_PAGES_REQUIRING_GUARD) {
		const entry = NAV_ACTION_BY_HREF.get(href);
		if (!entry) {
			throw new Error(
				`audit-abac-enforcement-parity: ${href} is in NAV_PAGES_REQUIRING_GUARD but absent ` +
					`from NAV_ACTION_MAP — the two have drifted.`,
			);
		}
		out.push([`${href.replace("/ap-admin/", "")}.astro`, entry.requiredAction]);
	}
	out.push(...NON_NAV_GUARDED_PAGES);
	return out;
}

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

	// Every action a nav leaf advertises must be a real registered action, so a
	// typo'd nav permission can never silently fall through to the adminOnly
	// fallback (the harness weakness behind #131/#135).
	for (const entry of NAV_ACTION_MAP) {
		if (!actions.has(entry.requiredAction)) {
			report.add(
				`NAV_ACTION_MAP[${entry.href}]: requiredAction "${entry.requiredAction}" is not a ` +
					`registered action in action-registry-data.ts (typo or missing registration).`,
			);
		}
	}

	for (const [page, action] of requiredPageGuards()) {
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
