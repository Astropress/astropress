import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { restoreRuntimeRevision } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/posts" }, async ({ actor, formData, locals, redirect, fail }) => {
    const slug = formData.get("slug") as string | null;
    const revisionId = formData.get("revisionId") as string | null;
    if (!slug || !revisionId) {
      return fail("Slug and revision ID are required", `/wp-admin/posts/${slug ?? ""}/revisions`);
    }

    const result = await restoreRuntimeRevision(slug, revisionId, actor, locals);
    if (!result.ok) {
      return fail(result.error, `/wp-admin/posts/${slug}/revisions`);
    }

    return redirect(`/wp-admin/posts/${slug}/revisions?restored=1`);
  });
