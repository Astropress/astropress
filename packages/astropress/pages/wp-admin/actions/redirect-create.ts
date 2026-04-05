import type { APIRoute } from "astro";
import { createRuntimeRedirectRule } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/redirects", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const result = await createRuntimeRedirectRule(
      {
        sourcePath: String(formData.get("sourcePath") ?? ""),
        targetPath: String(formData.get("targetPath") ?? ""),
        statusCode: Number(formData.get("statusCode") ?? "301"),
      },
      actor,
      locals,
    );

    if (!result.ok) {
      return fail(result.error);
    }

    return redirect("/wp-admin/redirects?saved=1");
  });
