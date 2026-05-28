/**
 * audit-forbidden-render-safety.ts
 *
 * Forbidden admin pages set `Astro.response.status = 403` (directly or when a
 * page-model returns `status === "forbidden"`) but still render the AdminLayout
 * shell. On an anonymous request `Astro.locals.adminUser` is `undefined`, so a
 * raw `userName={adminUser.name}` throws and the 403 becomes a 500 — the class
 * behind #105, #108, #138 and #139. The fix is the null-safe accessor
 * `safeAdminUserName(adminUser)`.
 *
 * Rule: in any `pages/ap-admin/**.astro` that can render while forbidden (its
 * frontmatter sets a 403 or branches on a forbidden status), the AdminLayout
 * `userName` prop must be fed through `safeAdminUserName(...)` — never a raw
 * `userName={adminUser.name}` / `userName={adminUser?.name}`.
 *
 * Exit 0 — every forbidden-capable page renders userName safely.
 * Exit 1 — a forbidden-capable page dereferences adminUser directly.
 */

import { relative } from "node:path";
import { AuditReport, fromRoot, listFiles, readText, runAudit } from "../lib/audit-utils.js";

const ADMIN_PAGES_ROOT = fromRoot("packages/astropress/pages/ap-admin");

/** A page can render while forbidden if it sets a 403 or branches on forbidden. */
function isForbiddenCapable(src: string): boolean {
	return /response\.status\s*=\s*403/.test(src) || /===\s*["']forbidden["']/.test(src);
}

/** A raw adminUser deref fed to the layout userName prop (the documented sink). */
const UNSAFE_USERNAME = /userName=\{adminUser\??\./;

async function main(): Promise<void> {
	const report = new AuditReport("forbidden-render-safety");

	const files = await listFiles(ADMIN_PAGES_ROOT, { recursive: true, extensions: [".astro"] });
	for (const file of files) {
		const abs = `${ADMIN_PAGES_ROOT}/${file}`;
		const src = await readText(abs);
		if (!isForbiddenCapable(src)) continue;
		if (UNSAFE_USERNAME.test(src)) {
			const rel = relative(fromRoot(), abs);
			report.add(
				`${rel}: forbidden-capable page passes a raw adminUser to AdminLayout userName. ` +
					`On an anonymous request adminUser is undefined and this throws a 500 instead of ` +
					`rendering the 403 shell. Use userName={safeAdminUserName(adminUser)} (#105/#108/#138/#139).`,
			);
		}
	}

	report.finish(
		"✓ audit:forbidden-render-safety — forbidden admin pages render userName null-safely",
	);
}

runAudit("forbidden-render-safety", main);
