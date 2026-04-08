import type { APIRoute } from "astro";
import { invalidateAstropressAdminSlugCache, saveRuntimeSettings, withAdminFormAction } from "astropress";

const RESERVED_SLUGS = new Set(["", "api", "assets", "_astro", "cdn-cgi"]);
const VALID_SLUG = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/route-pages", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const raw = String(formData.get("adminSlug") ?? "").trim().toLowerCase();

    if (!raw) {
      return fail("Admin slug cannot be empty.");
    }
    if (!VALID_SLUG.test(raw)) {
      return fail("Admin slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.");
    }
    if (RESERVED_SLUGS.has(raw)) {
      return fail(`"${raw}" is a reserved path and cannot be used as the admin slug.`);
    }

    const result = await saveRuntimeSettings({ adminSlug: raw }, actor, locals);
    if (!result.ok) {
      return fail("Failed to save admin slug.");
    }

    invalidateAstropressAdminSlugCache();

    // Redirect to the route-pages screen under the new slug.
    return redirect(`/${raw}/route-pages?slugSaved=1`);
  });
