import { addRuntimeRolePolicy, withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{
			failurePath: "/ap-admin/access?tab=roles",
			requireAction: "roles:manage",
		},
		async ({ formData, locals, redirect, fail }) => {
			const roleId = String(formData.get("roleId") ?? "");
			const action = String(formData.get("action") ?? "").trim();
			const effect = String(formData.get("effect") ?? "");
			const priorityRaw = formData.get("priority");
			const priority = priorityRaw ? Number(priorityRaw) : 0;
			if (!roleId || !action) return fail("Missing roleId or action.");
			if (effect !== "allow" && effect !== "deny") {
				return fail("Effect must be allow or deny.");
			}
			const result = await addRuntimeRolePolicy(locals, {
				roleId,
				effect,
				action,
				priority: Number.isFinite(priority) ? priority : 0,
			});
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=roles&policy_added=1");
		},
	);
