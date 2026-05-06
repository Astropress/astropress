import { deleteRuntimeRole, withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{
			failurePath: "/ap-admin/access?tab=roles",
			requireAction: "roles:manage",
		},
		async ({ formData, locals, redirect, fail }) => {
			const id = String(formData.get("roleId") ?? "");
			if (!id) return fail("Missing roleId.");
			const result = await deleteRuntimeRole(locals, { id });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=roles&deleted=1");
		},
	);
