import { getCmsConfig, getRuntimeContentRevisions } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import { apiErrors, jsonOk, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens) return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["content:read"],
		async () => {
			const recordId = context.params.recordId ?? "";
			const revisions = await getRuntimeContentRevisions(recordId, context.locals);
			return jsonOk({ records: revisions, total: revisions.length });
		},
	);
};
