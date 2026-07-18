/**
 * Host-side admin session resolver.
 *
 * The admin page guards (`adminOnlyPage`, the page models, and
 * `getAccessContext`) all read `Astro.locals.adminUser` — but nothing in the
 * package populates it from the login session cookie. Historically each host
 * had to write this itself (and the e2e harness fakes it), so a project that
 * merely wired `createAstropressAdminAppIntegration` could log in yet still 403
 * on every admin page.
 *
 * This middleware closes that gap: it reads the session cookie, resolves the
 * signed-in user via the runtime session store, and populates
 * `locals.adminUser` + `locals.csrfToken` for the rest of the request. It is
 * auto-injected by `createAstropressAdminAppIntegration`, and also exported so
 * hosts with a custom middleware stack can compose it explicitly.
 *
 * It is intentionally conservative: it never overwrites an `adminUser` that a
 * host (or the e2e harness) already set, and it no-ops when there is no session
 * cookie — so anonymous requests and the fake-auth harness are unaffected.
 */

import {
	LEGACY_SESSION_COOKIE,
	LOCAL_SESSION_COOKIE,
	SECURE_SESSION_COOKIE,
} from "./admin-action-utils-data";
import { getRuntimeCsrfToken, getRuntimeSessionUser } from "./runtime-admin-auth";
import { getLoginSecurityConfig } from "./runtime-env";

interface AdminSessionMiddlewareContext {
	cookies: {
		get(name: string): { value: string } | undefined;
	};
	locals: App.Locals;
}

function readSessionToken(
	cookies: AdminSessionMiddlewareContext["cookies"],
	secureCookies: boolean,
): string | undefined {
	const primary = secureCookies ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
	return cookies.get(primary)?.value ?? cookies.get(LEGACY_SESSION_COOKIE)?.value;
}

export function createAstropressAdminSessionMiddleware() {
	return async (
		context: AdminSessionMiddlewareContext,
		next: () => Promise<Response>,
	): Promise<Response> => {
		const locals = context.locals as App.Locals & {
			adminUser?: { id: string; email: string; isAdmin: boolean; name?: string };
			csrfToken?: string;
		};

		// Never clobber a user a host middleware (or the e2e harness) already set.
		if (!locals.adminUser) {
			const { secureCookies } = getLoginSecurityConfig(locals);
			const token = readSessionToken(context.cookies, secureCookies);
			if (token) {
				const user = await getRuntimeSessionUser(token, locals);
				if (user) {
					locals.adminUser = {
						id: user.email,
						email: user.email,
						isAdmin: user.isAdmin,
						name: user.name,
					};
					locals.csrfToken = (await getRuntimeCsrfToken(token, locals)) ?? undefined;
				}
			}
		}

		return next();
	};
}
