import type { APIRoute } from "astro";
import { withAdminFormAction } from "astropress";
import { restoreRuntimeRevision } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/posts" }, async ({ actor, formData, locals, redirect, fail }) => {
    const slug = formData.get("slug") as string | null;
    const revisionId = formData.get("revisionId") as string | null;
    if (!slug || !revisionId) {
      return fail("Slug and revision ID are required", `/ap-admin/posts/${slug ?? ""}/revisions`);
    }

    const result = await restoreRuntimeRevision(slug, revisionId, actor, locals);
    if (!result.ok) {
      return fail(result.error, `/ap-admin/posts/${slug}/revisions`);
    }

    return redirect(`/ap-admin/posts/${slug}/revisions?restored=1`);
  });
