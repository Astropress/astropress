/**
 * GET /ap-admin/api/media — JSON list of media assets for the picker dialog.
 *
 * Returns the same data as the media admin page but in a compact JSON shape
 * keyed by asset id. Admin-only — non-admins get 403, unauthenticated 401.
 */

import { buildMediaPageModel, isAuthUserAdmin } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const adminUser = locals.adminUser;
	if (!adminUser) {
		return new Response(JSON.stringify({ error: "unauthenticated" }), {
			status: 401,
			headers: { "content-type": "application/json" },
		});
	}
	if (!isAuthUserAdmin(adminUser)) {
		return new Response(JSON.stringify({ error: "forbidden" }), {
			status: 403,
			headers: { "content-type": "application/json" },
		});
	}
	const model = await buildMediaPageModel(locals);
	const items = model.data.mediaWithResolvedUrls.map((asset) => ({
		id: asset.id,
		url: asset.resolvedUrl,
		title: asset.title ?? "",
		altText: asset.altText ?? "",
		mimeType: asset.mimeType ?? "",
		width: asset.width ?? null,
		height: asset.height ?? null,
	}));
	return new Response(JSON.stringify({ items }), {
		status: 200,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	});
};
