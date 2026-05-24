import { validateWebhookCreateInput, withAdminFormAction } from "@astropress-diy/astropress";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
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

			const store = await loadLocalAdminStore();
			if (!store.webhooks) return fail("Webhook store is not available.");

			const { record, verification } = await store.webhooks.create(validation.value);
			return redirect(
				`/ap-admin/webhooks?created=1&webhookId=${encodeURIComponent(record.id)}&algorithm=${encodeURIComponent(verification.algorithm)}&publicKey=${encodeURIComponent(verification.publicKey)}`,
			);
		},
	);
