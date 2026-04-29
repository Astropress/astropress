import {
	removeRuntimeRolePolicy,
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
			const policyId = String(formData.get("policyId") ?? "");
			if (!policyId) return fail("Missing policyId.");
			const result = await removeRuntimeRolePolicy(locals, { policyId });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=roles&policy_removed=1");
		},
	);
