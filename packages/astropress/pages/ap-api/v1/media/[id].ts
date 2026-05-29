import { deleteRuntimeMediaAsset, getCmsConfig } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import { apiErrors, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import type { APIRoute } from "astro";

export const DELETE: APIRoute = async (context) => {
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
		["media:write"],
		async (tokenId) => {
			const id = context.params.id ?? "";
			const actor = {
				email: `api-token:${tokenId}`,
				role: "editor" as const,
				name: "API Token",
			};
			const result = (await deleteRuntimeMediaAsset(id, actor, context.locals)) as
				| { ok: true }
				| { ok: false; error: string };
			if (!result.ok) return apiErrors.notFound(result.error);
			return new Response(null, { status: 204 });
		},
	);
};
