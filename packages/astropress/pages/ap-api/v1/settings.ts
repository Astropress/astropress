import { getCmsConfig, getRuntimeSettings } from "@astropress-diy/astropress";
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
		["settings:read"],
		async () => {
			const settings = await getRuntimeSettings(context.locals);
			return jsonOk(settings);
		},
	);
};
