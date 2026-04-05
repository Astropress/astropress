import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { deleteRuntimeCategory, deleteRuntimeTag } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/taxonomies", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const id = Number.parseInt((formData.get("id") as string | null) ?? "", 10);
    const kind = (formData.get("kind") as string | null) === "tag" ? "tag" : "category";
    if (!Number.isFinite(id)) {
      return fail("Taxonomy id is required");
    }

    const result = kind === "tag" ? await deleteRuntimeTag(id, actor, locals) : await deleteRuntimeCategory(id, actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/wp-admin/taxonomies?deleted=1");
  });
