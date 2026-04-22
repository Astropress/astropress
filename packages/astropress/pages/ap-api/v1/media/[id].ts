import { getCmsConfig } from "@astropress-diy/astropress";
import {
	apiErrors,
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

export const DELETE: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled)
		return apiErrors.notFound("REST API is not enabled.");

	const store = await loadLocalAdminStore();
	if (!store.apiTokens)
		return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		buildApiCtx(store, getCmsConfig()),
		["media:write"],
		async () => {
			const id = context.params.id ?? "";
			await store.deleteMediaAsset(id);
			return new Response(null, { status: 204 });
		},
	);
};
