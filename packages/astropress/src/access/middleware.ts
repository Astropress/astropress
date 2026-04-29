/**
 * Optional Astro middleware factory that eagerly resolves the per-request
 * access context. Most call sites can use `getAccessContext(astro)` lazily
 * from page frontmatter or action handlers; mounting this middleware just
 * shifts the resolution to the start of the request so downstream code
 * can read `Astro.locals.access` directly without an `await`.
 */

import { getAccessContext } from "./request-context";

type MiddlewareInput = {
	locals: App.Locals;
};

export function createAccessMiddleware() {
	return async (
		ctx: MiddlewareInput,
		next: () => Promise<Response>,
	): Promise<Response> => {
		await getAccessContext(ctx);
		return next();
	};
}
