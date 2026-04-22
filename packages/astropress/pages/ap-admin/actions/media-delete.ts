import { deleteRuntimeMediaAsset } from "@astropress-diy/astropress";
import { withAdminFormAction } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/media" },
		async ({ actor, formData, locals, redirect, fail }) => {
			const result = await deleteRuntimeMediaAsset(
				String(formData.get("id") ?? ""),
				actor,
				locals,
			);
			if (!result.ok) {
				return fail(result.error);
			}
			return redirect("/ap-admin/media?deleted=1");
		},
	);
