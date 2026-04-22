import { createRuntimeRedirectRule } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/redirects", requireAdmin: true },
		async ({ actor, formData, locals, redirect, fail }) => {
			const result = await createRuntimeRedirectRule(
				{
					sourcePath: String(formData.get("sourcePath") ?? ""),
					targetPath: String(formData.get("targetPath") ?? ""),
					statusCode: Number(formData.get("statusCode") ?? "301"),
				},
				actor,
				locals,
			);

			if (!result.ok) {
				return fail(result.error);
			}

			return redirect("/ap-admin/redirects?saved=1");
		},
	);
