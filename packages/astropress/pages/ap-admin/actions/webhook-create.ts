import { validateWebhookCreateInput, withAdminFormAction } from "@astropress-diy/astropress";
import {
	resolveApiRuntime,
	resolveFlashStore,
} from "@astropress-diy/astropress/admin-store-dispatch.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) =>
	withAdminFormAction(
		context,
		{ failurePath: "/ap-admin/webhooks", requireAction: "webhooks:manage" },
		async ({ formData, redirect, fail }) => {
			const validation = validateWebhookCreateInput({
				url: formData.get("url"),
				events: formData.getAll("events").map(String),
			});
			if (!validation.ok) return fail(validation.error);

			const { webhooks } = await resolveApiRuntime(context.locals);
			if (!webhooks) return fail("Webhook store is not available.");

			const { record, verification } = await webhooks.create(validation.value);
			// The verification material (algorithm + public key) is shown once;
			// hand it off via the flash store rather than the URL (#115).
			const flash = await resolveFlashStore(context.locals);
			if (!flash) return fail("Flash store is not available.");
			const { id } = await flash.put(
				JSON.stringify({ algorithm: verification.algorithm, publicKey: verification.publicKey }),
			);
			return redirect(
				`/ap-admin/webhooks?created=1&webhookId=${encodeURIComponent(record.id)}&flash=${encodeURIComponent(id)}`,
			);
		},
	);
