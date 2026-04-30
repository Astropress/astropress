import {
	createRuntimeRole,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{
			failurePath: "/ap-admin/access?tab=roles",
			requireAction: "roles:manage",
		},
		async ({ formData, locals, redirect, fail }) => {
			const name = String(formData.get("name") ?? "");
			const description = String(formData.get("description") ?? "");
			const result = await createRuntimeRole(locals, { name, description });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=roles&created=1");
		},
	);
