import type { APIContext } from "astro";

import { getRuntimeSettings } from "./runtime-page-store";

const DEFAULT_ADMIN_SLUG = "ap-admin";
const ADMIN_SLUG_CACHE_TTL_MS = 60_000;

let cachedAdminSlug: string | null = null;
let cachedAdminSlugAt = 0;

export function invalidateAstropressAdminSlugCache() {
  cachedAdminSlug = null;
}

export async function resolveAstropressAdminSlug(locals: APIContext["locals"]) {
  const now = Date.now();
  if (cachedAdminSlug !== null && now - cachedAdminSlugAt < ADMIN_SLUG_CACHE_TTL_MS) {
    return cachedAdminSlug;
  }

  try {
    const settings = await getRuntimeSettings(locals);
    cachedAdminSlug = settings.adminSlug || DEFAULT_ADMIN_SLUG;
    cachedAdminSlugAt = now;
    return cachedAdminSlug;
  } catch {
    return DEFAULT_ADMIN_SLUG;
  }
}
