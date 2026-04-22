import { withAdminFormAction } from "@astropress-diy/astropress";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import type { WebhookEvent } from "@astropress-diy/astropress/platform-contracts.js";
import type { APIRoute } from "astro";

const VALID_EVENTS: WebhookEvent[] = [
	"content.published",
	"content.updated",
	"content.deleted",
	"media.uploaded",
	"media.deleted",
];

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/webhooks", requireAdmin: true },
		async ({ formData, redirect, fail }) => {
			const url = String(formData.get("url") ?? "").trim();
			if (!url) return fail("Webhook URL is required.");
			if (!url.startsWith("https://") && !url.startsWith("http://"))
				return fail("URL must start with http:// or https://");

			const eventValues = formData
				.getAll("events")
				.map(String) as WebhookEvent[];
			const events = eventValues.filter((e) => VALID_EVENTS.includes(e));
			if (events.length === 0) return fail("At least one event is required.");

			const store = await loadLocalAdminStore();
			if (!store.webhooks) return fail("Webhook store is not available.");

			const { record, verification } = await store.webhooks.create({
				url,
				events,
			});
			return redirect(
				`/ap-admin/webhooks?created=1&webhookId=${encodeURIComponent(record.id)}&algorithm=${encodeURIComponent(verification.algorithm)}&publicKey=${encodeURIComponent(verification.publicKey)}`,
			);
		},
	);
