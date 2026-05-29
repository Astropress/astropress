import { withAdminFormAction } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/webhooks", requireAction: "webhooks:manage" },
		async ({ formData, redirect, fail }) => {
			const id = String(formData.get("id") ?? "").trim();
			if (!id) return fail("Webhook ID is required.");

			const { webhooks } = await resolveApiRuntime(context.locals);
			if (!webhooks) return fail("Webhook store is not available.");

			await webhooks.delete(id);
			return redirect("/ap-admin/webhooks?deleted=1");
		},
	);
