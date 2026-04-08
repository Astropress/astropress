import type { APIRoute } from "astro";
import { moderateRuntimeComment } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/comments" }, async ({ actor, formData, locals, redirect, fail }) => {
    const commentId = String(formData.get("commentId") ?? "");
    const statusValue = String(formData.get("status") ?? "");
    const status = statusValue === "approved" || statusValue === "rejected" ? statusValue : "pending";

    const result = await moderateRuntimeComment(commentId, status, actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/ap-admin/comments?saved=1");
  });
