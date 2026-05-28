import { deleteRuntimeRedirectRule, withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/redirects", requireAction: "redirects:manage" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const sourcePath = formData.get("sourcePath") as string | null;
			if (!sourcePath) {
				return fail("Source path is required");
			}

			const result = await deleteRuntimeRedirectRule(sourcePath, actor, locals);
			if (!result.ok) {
				return fail("Redirect rule not found");
			}

			return redirect("/ap-admin/redirects?deleted=1");
		},
	);
