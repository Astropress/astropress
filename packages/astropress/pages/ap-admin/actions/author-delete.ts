import type { APIRoute } from "astro";
import { deleteRuntimeAuthor } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/authors", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const id = Number.parseInt((formData.get("id") as string | null) ?? "", 10);
    if (!Number.isFinite(id)) {
      return fail("Author id is required");
    }

    const result = await deleteRuntimeAuthor(id, actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }

    return redirect(`/ap-admin/authors?deleted=1&restore_table=authors&restore_id=${id}`);
  });
