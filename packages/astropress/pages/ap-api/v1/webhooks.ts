import { getCmsConfig, validateWebhookCreateInput } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import {
	apiErrors,
	type JsonValue,
	jsonOk,
	jsonOkPaginated,
	withApiRequest,
} from "@astropress-diy/astropress/api-middleware.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens || !runtime.webhooks)
		return apiErrors.notFound("Webhook store unavailable.");
	const webhooks = runtime.webhooks;

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["webhooks:manage"],
		async () => {
			const url = new URL(context.request.url);
			const limit = Math.min(
				Number(url.searchParams.get("limit") ?? url.searchParams.get("per_page") ?? "20"),
				100,
			);
			const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
			const offset = Number(url.searchParams.get("offset") ?? String((page - 1) * limit));

			const all = await webhooks.list();
			const pageRecords = all.slice(offset, offset + limit);
			return jsonOkPaginated(
				{ records: pageRecords, total: all.length, limit, offset, page } as unknown as JsonValue,
				all.length,
			);
		},
	);
};

export const POST: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens || !runtime.webhooks)
		return apiErrors.notFound("Webhook store unavailable.");
	const webhooks = runtime.webhooks;

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["webhooks:manage"],
		async () => {
			let body: Record<string, unknown>;
			try {
				body = (await context.request.json()) as Record<string, unknown>;
			} catch {
				return apiErrors.validationError("Request body must be valid JSON.");
			}

			const validation = validateWebhookCreateInput({
				url: body.url,
				events: body.events,
			});
			if (!validation.ok) return apiErrors.validationError(validation.error);

			const { record, verification } = await webhooks.create(validation.value);
			return jsonOk({ record, verification } as unknown as JsonValue, 201);
		},
	);
};
