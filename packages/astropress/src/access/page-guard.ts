/**
 * Page-frontmatter access guard.
 *
 * Replaces the legacy `if (!adminUser || adminUser.role !== "admin") return
 * Astro.redirect(...)` block with a single `await requiresAccess(Astro,
 * "<action>")` call. The guard loads `Astro.locals.access` lazily, evaluates
 * the requested ABAC action, and returns:
 *
 *   - `null` when the subject is allowed (caller continues rendering)
 *   - a `Response` redirect when the subject is unauthenticated or denied
 *
 * Astro frontmatter pattern:
 *
 *   const guard = await requiresAccess(Astro, "settings:edit");
 *   if (guard) return guard;
 *
 * Server-side enforcement is the source of truth. Nav-level filtering is a
 * UI mirror — never rely on hiding a leaf as a security control.
 */

import { logAccessDeny } from "./audit-deny";
import { DEFAULT_FORBIDDEN_PATH, DEFAULT_LOGIN_PATH } from "./page-guard-data.js";
import { getAccessContext } from "./request-context";
import type { Env, Resource } from "./types";

export interface RequiresAccessOptions {
	resource?: Resource;
	env?: Env;
	/** Override the redirect target on deny. Defaults to /ap-admin?error=insufficient-permissions. */
	forbiddenPath?: string;
	/** Override the redirect target when there is no authenticated user. Defaults to /ap-admin/login. */
	loginPath?: string;
}

type AstroLike = {
	locals: App.Locals;
	// Method syntax (not an arrow field) so `status` is checked bivariantly:
	// Astro's `redirect` types it as the narrow ValidRedirectStatus union, which
	// an arrow field's strict contravariance would reject here.
	redirect(path: string, status?: number): Response;
};

export async function requiresAccess(
	astro: AstroLike,
	action: string,
	options: RequiresAccessOptions = {},
): Promise<Response | null> {
	const access = await getAccessContext(astro);

	if (!access) {
		return astro.redirect(options.loginPath ?? DEFAULT_LOGIN_PATH);
	}

	const decision = access.can(action, options.resource, options.env);
	if (decision.decision === "deny") {
		await logAccessDeny(astro.locals, {
			subjectEmail: access.subject.email,
			action,
			decision,
		});
		const reason = encodeURIComponent(decision.reason);
		const fallback = `${DEFAULT_FORBIDDEN_PATH}&reason=${reason}`;
		return astro.redirect(options.forbiddenPath ?? fallback);
	}

	return null;
}
