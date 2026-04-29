import {
	assignRuntimeUserRole,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/access", requireAction: "roles:assign" },
		async ({ formData, locals, redirect, fail }) => {
			const userId = Number(formData.get("userId") ?? 0);
			const roleId = String(formData.get("roleId") ?? "");
			if (!userId || !roleId) return fail("Missing userId or roleId.");
			const result = await assignRuntimeUserRole(locals, { userId, roleId });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=users&assigned=1");
		},
	);
