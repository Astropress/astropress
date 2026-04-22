import { getRuntimeContentRevisions } from "@astropress-diy/astropress";
import { getCmsConfig } from "@astropress-diy/astropress";
import {
	apiErrors,
	jsonOk,
	withApiRequest,
} from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import type { APIRoute } from "astro";

function buildApiCtx(
	store: Awaited<ReturnType<typeof loadLocalAdminStore>>,
	config: ReturnType<typeof getCmsConfig>,
) {
	return {
		// biome-ignore lint/style/noNonNullAssertion: apiTokens is always set when API token auth middleware is active
		apiTokens: store.apiTokens!,
		checkRateLimit: store.checkRateLimit,
		rateLimit: config.api?.rateLimit,
	};
}

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled)
		return apiErrors.notFound("REST API is not enabled.");

	const store = await loadLocalAdminStore();
	if (!store.apiTokens)
		return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		buildApiCtx(store, getCmsConfig()),
		["content:read"],
		async () => {
			const recordId = context.params.recordId ?? "";
			const revisions = await getRuntimeContentRevisions(
				recordId,
				context.locals,
			);
			return jsonOk({ records: revisions, total: revisions.length });
		},
	);
};
