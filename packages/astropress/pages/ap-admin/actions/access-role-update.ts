import { updateRuntimeRole, withAdminFormAction } from "@astropress-diy/astropress";
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
			const name = formData.has("name") ? String(formData.get("name") ?? "") : undefined;
			const description = formData.has("description")
				? String(formData.get("description") ?? "")
				: undefined;
			const result = await updateRuntimeRole(locals, { id, name, description });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=roles&updated=1");
		},
	);
