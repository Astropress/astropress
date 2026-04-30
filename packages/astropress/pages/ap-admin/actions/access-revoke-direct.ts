import {
	removeRuntimeUserDirectGrant,
	withAdminFormAction,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/access", requireAction: "grants:manage" },
		async ({ formData, locals, redirect, fail }) => {
			const grantId = String(formData.get("grantId") ?? "").trim();
			if (!grantId) return fail("Missing grantId.");
			const result = await removeRuntimeUserDirectGrant(locals, { grantId });
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=users&revoked=1");
		},
	);
