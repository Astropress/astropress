import { getCmsConfig } from "@astropress-diy/astropress";
import { apiErrors, jsonOk, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import type { APIRoute } from "astro";

type LocalAdminStore = Awaited<ReturnType<typeof loadLocalAdminStore>>;
type ApiTokens = NonNullable<LocalAdminStore["apiTokens"]>;

function buildApiCtx(
	apiTokens: ApiTokens,
	store: LocalAdminStore,
	config: ReturnType<typeof getCmsConfig>,
) {
	return {
		apiTokens,
		checkRateLimit: store.checkRateLimit,
		rateLimit: config.api?.rateLimit,
	};
}

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const store = await loadLocalAdminStore();
	if (!store.apiTokens) return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		buildApiCtx(store.apiTokens, store, getCmsConfig()),
		["settings:read"],
		async () => {
			const settings = store.getSettings();
			return jsonOk(settings);
		},
	);
};
