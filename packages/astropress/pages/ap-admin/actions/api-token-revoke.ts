import { withAdminFormAction } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/api-tokens", requireAdmin: true },
		async ({ formData, redirect, fail }) => {
			const id = String(formData.get("id") ?? "").trim();
			if (!id) return fail("Token ID is required.");

			const { apiTokens } = await resolveApiRuntime(context.locals);
			if (!apiTokens) return fail("API token store is not available.");

			await apiTokens.revoke(id);
			return redirect("/ap-admin/api-tokens?revoked=1");
		},
	);
