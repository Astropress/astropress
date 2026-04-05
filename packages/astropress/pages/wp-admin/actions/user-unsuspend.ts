import type { APIRoute } from "astro";
import { unsuspendRuntimeAdminUser } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/wp-admin/users", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const result = await unsuspendRuntimeAdminUser(String(formData.get("email") ?? ""), actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }
    return redirect("/wp-admin/users?restored=1");
  });
