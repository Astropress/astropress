import type { APIRoute } from "astro";
import { withAdminFormAction } from "@astropress-diy/astropress";
import { saveRuntimeArchiveRoute } from "@astropress-diy/astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/archives" }, async ({ actor, formData, locals, redirect, fail }) => {
    const path = String(formData.get("path") ?? "");
    const editorPath = `/ap-admin/archives/${path.replace(/^\//, "")}`;
    const result = await saveRuntimeArchiveRoute(
      path,
      {
        title: String(formData.get("title") ?? ""),
        summary: String(formData.get("summary") ?? ""),
        seoTitle: String(formData.get("seoTitle") ?? ""),
        metaDescription: String(formData.get("metaDescription") ?? ""),
        canonicalUrlOverride: String(formData.get("canonicalUrlOverride") ?? ""),
        robotsDirective: String(formData.get("robotsDirective") ?? ""),
        revisionNote: String(formData.get("revisionNote") ?? ""),
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error, editorPath);
    }

    return redirect(`${editorPath}?saved=1`);
  });
