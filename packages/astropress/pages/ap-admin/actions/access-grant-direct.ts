import { addRuntimeUserDirectGrant, withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/access", requireAction: "grants:manage" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const userId = Number(formData.get("userId") ?? 0);
			const action = String(formData.get("action") ?? "").trim();
			const effect = String(formData.get("effect") ?? "allow");
			if (!userId || !action) return fail("Missing userId or action.");
			if (effect !== "allow" && effect !== "deny") {
				return fail("Effect must be allow or deny.");
			}
			const result = await addRuntimeUserDirectGrant(locals, {
				userId,
				effect,
				action,
				grantedBy: actor.email,
			});
			if (!result.ok) return fail(result.error);
			return redirect("/ap-admin/access?tab=users&granted=1");
		},
	);
