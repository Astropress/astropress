import type { APIRoute } from "astro";
import { saveRuntimeContentState } from "astropress";
import { withAdminFormAction } from "astropress";
import { sanitizeHtml } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/posts" }, async ({ actor, formData, locals, redirect, fail }) => {
    const slug = String(formData.get("slug") ?? "");
    const result = await saveRuntimeContentState(
      slug,
      {
        title: String(formData.get("title") ?? ""),
        status: String(formData.get("status") ?? ""),
        scheduledAt: String(formData.get("scheduledAt") ?? ""),
        body: sanitizeHtml(String(formData.get("body") ?? "")),
        authorIds: formData.getAll("authorIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
        categoryIds: formData.getAll("categoryIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
        tagIds: formData.getAll("tagIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
        seoTitle: String(formData.get("seoTitle") ?? ""),
        metaDescription: String(formData.get("metaDescription") ?? ""),
        excerpt: String(formData.get("excerpt") ?? ""),
        ogTitle: String(formData.get("ogTitle") ?? ""),
        ogDescription: String(formData.get("ogDescription") ?? ""),
        ogImage: String(formData.get("ogImage") ?? ""),
        canonicalUrlOverride: String(formData.get("canonicalUrlOverride") ?? ""),
        robotsDirective: String(formData.get("robotsDirective") ?? ""),
        revisionNote: String(formData.get("revisionNote") ?? ""),
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error, `/wp-admin/posts/${slug}`);
    }

    return redirect(`/wp-admin/posts/${slug}?saved=1`);
  });
