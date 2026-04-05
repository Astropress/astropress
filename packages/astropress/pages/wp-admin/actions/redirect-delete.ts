import type { APIRoute } from "astro";
import { deleteRuntimeRedirectRule } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/redirects", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const sourcePath = formData.get("sourcePath") as string | null;
    if (!sourcePath) {
      return fail("Source path is required");
    }

    const result = await deleteRuntimeRedirectRule(sourcePath, actor, locals);
    if (!result.ok) {
      return fail("Redirect rule not found");
    }

    return redirect("/wp-admin/redirects?deleted=1");
  });
