import type { APIRoute } from "astro";
import { createRuntimeAuthor, updateRuntimeAuthor } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/authors", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const id = Number.parseInt((formData.get("id") as string | null) ?? "", 10);
    const payload = {
      name: ((formData.get("name") as string | null) ?? "").trim(),
      slug: ((formData.get("slug") as string | null) ?? "").trim() || undefined,
      bio: ((formData.get("bio") as string | null) ?? "").trim() || undefined,
    };
    const result = Number.isFinite(id)
      ? await updateRuntimeAuthor({ id, ...payload }, actor, locals)
      : await createRuntimeAuthor(payload, actor, locals);

    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/wp-admin/authors?saved=1");
  });
