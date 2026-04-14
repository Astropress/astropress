import type { APIRoute } from "astro";
import { unsuspendRuntimeAdminUser } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";

export const POST: APIRoute = async (context) =>
  withAdminFormAction(context, { failurePath: "/ap-admin/users", requireAdmin: true }, async ({ actor, formData, locals, redirect, fail }) => {
    const result = await unsuspendRuntimeAdminUser(String(formData.get("email") ?? ""), actor, locals);
    if (!result.ok) {
      return fail(result.error);
    }
    return redirect("/ap-admin/users?restored=1");
  });
