import {
	getCmsConfig,
	getRuntimeContentState,
	saveRuntimeContentState,
} from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import {
	apiErrors,
	type JsonValue,
	jsonOk,
	jsonOkWithEtag,
	withApiRequest,
} from "@astropress-diy/astropress/api-middleware.js";
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
			const id = context.params.id ?? "";
			const record = await getRuntimeContentState(id, context.locals);
			if (!record) return apiErrors.notFound(`Content '${id}' not found.`);
			return jsonOkWithEtag(record as unknown as JsonValue, context.request);
		},
	);
};

export const PUT: APIRoute = async (context) => {
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
		["content:write"],
		async (tokenId) => {
			const id = context.params.id ?? "";
			const existing = await getRuntimeContentState(id, context.locals);
			if (!existing) return apiErrors.notFound(`Content '${id}' not found.`);

			let body: Record<string, unknown>;
			try {
				body = (await context.request.json()) as Record<string, unknown>;
			} catch {
				return apiErrors.validationError("Request body must be valid JSON.");
			}

			const actor = {
				email: `api-token:${tokenId}`,
				role: "editor" as const,
				name: "API Token",
			};
			const result = (await saveRuntimeContentState(
				id,
				{
					title: String(body.title ?? existing.title ?? ""),
					status: String(body.status ?? existing.status ?? "draft"),
					body: String(body.body ?? existing.body ?? ""),
					seoTitle: String(body.seoTitle ?? existing.seoTitle ?? ""),
					metaDescription: String(body.metaDescription ?? existing.metaDescription ?? ""),
					excerpt: String(body.excerpt ?? existing.excerpt ?? ""),
					ogTitle: String(body.ogTitle ?? ""),
					ogDescription: String(body.ogDescription ?? ""),
					ogImage: String(body.ogImage ?? ""),
					canonicalUrlOverride: String(body.canonicalUrlOverride ?? ""),
					robotsDirective: String(body.robotsDirective ?? ""),
					revisionNote: "API update",
				},
				actor,
				context.locals,
			)) as { ok: false; error: string } | { ok: true; state: Record<string, unknown> | null };

			if (!result.ok) return apiErrors.validationError(result.error);

			if (runtime.webhooks) {
				const event = result.state?.status === "published" ? "content.updated" : null;
				if (event) await runtime.webhooks.dispatch(event, { id });
			}

			return jsonOk(result.state as unknown as JsonValue);
		},
	);
};

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
		["content:write"],
		async () => {
			const id = context.params.id ?? "";
			const existing = await getRuntimeContentState(id, context.locals);
			if (!existing) return apiErrors.notFound(`Content '${id}' not found.`);

			// Mark as archived (soft-delete approach consistent with admin UI)
			const actor = { email: "api", role: "editor" as const, name: "API" };
			await saveRuntimeContentState(
				id,
				{
					title: existing.title ?? id,
					status: "archived",
					seoTitle: "",
					metaDescription: "",
					excerpt: "",
					ogTitle: "",
					ogDescription: "",
					ogImage: "",
					canonicalUrlOverride: "",
					robotsDirective: "",
					revisionNote: "Deleted via API",
					body: existing.body ?? "",
				},
				actor,
				context.locals,
			);

			if (runtime.webhooks) {
				await runtime.webhooks.dispatch("content.deleted", { id });
			}

			return new Response(null, { status: 204 });
		},
	);
};
