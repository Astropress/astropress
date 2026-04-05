import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { createRuntimeCategory, createRuntimeTag, updateRuntimeCategory, updateRuntimeTag } from "astropress";
export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/taxonomies", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const kind = (formData.get("kind") as string | null) === "tag" ? "tag" : "category";
    const id = Number.parseInt((formData.get("id") as string | null) ?? "", 10);
    const payload = {
      name: ((formData.get("name") as string | null) ?? "").trim(),
      slug: ((formData.get("slug") as string | null) ?? "").trim() || undefined,
      description: ((formData.get("description") as string | null) ?? "").trim() || undefined,
    };

    const result = kind === "tag"
      ? Number.isFinite(id)
        ? await updateRuntimeTag({ id, ...payload }, actor, locals)
        : await createRuntimeTag(payload, actor, locals)
      : Number.isFinite(id)
        ? await updateRuntimeCategory({ id, ...payload }, actor, locals)
        : await createRuntimeCategory(payload, actor, locals);

    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/wp-admin/taxonomies?saved=1");
  });
