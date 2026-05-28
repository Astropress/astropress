import { validateWebhookCreateInput, withAdminFormAction } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/webhooks", requireAdmin: true },
		async ({ formData, redirect, fail }) => {
			const validation = validateWebhookCreateInput({
				url: formData.get("url"),
				events: formData.getAll("events").map(String),
			});
			if (!validation.ok) return fail(validation.error);

			const { webhooks } = await resolveApiRuntime(context.locals);
			if (!webhooks) return fail("Webhook store is not available.");

			const { record, verification } = await webhooks.create(validation.value);
			return redirect(
				`/ap-admin/webhooks?created=1&webhookId=${encodeURIComponent(record.id)}&algorithm=${encodeURIComponent(verification.algorithm)}&publicKey=${encodeURIComponent(verification.publicKey)}`,
			);
		},
	);
