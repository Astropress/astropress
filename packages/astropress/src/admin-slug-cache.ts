import type { APIContext } from "astro";

import { getRuntimeSettings } from "./runtime-page-store";

const ADMIN_SLUG_CACHE_TTL_MS = 60_000;

let cachedAdminSlug: string | null = null;
let cachedAdminSlugAt = 0;

export function invalidateAstropressAdminSlugCache() {
	cachedAdminSlug = null;
}

// Inlined literal (rather than a module-level const) so the StringLiteral
// mutation lives inside this function body — every call covers it,
// rather than only the first test that loads the module.
function defaultAdminSlug(): "ap-admin" {
	return "ap-admin";
}

export async function resolveAstropressAdminSlug(locals: APIContext["locals"]) {
	const now = Date.now();
	if (cachedAdminSlug !== null && now - cachedAdminSlugAt < ADMIN_SLUG_CACHE_TTL_MS) {
		return cachedAdminSlug;
	}

	try {
		const settings = await getRuntimeSettings(locals);
		cachedAdminSlug = settings.adminSlug || defaultAdminSlug();
		cachedAdminSlugAt = now;
		return cachedAdminSlug;
	} catch {
		return defaultAdminSlug();
	}
}
