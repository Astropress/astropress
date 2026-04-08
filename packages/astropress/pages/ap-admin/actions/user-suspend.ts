import type { APIRoute } from "astro";
import { suspendRuntimeAdminUser } from "astropress";
import { withAdminFormAction } from "astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/users", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const result = await suspendRuntimeAdminUser(String(formData.get("email") ?? ""), actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }
    return redirect("/ap-admin/users?suspended=1");
  });
