/**
 * GET /ap-admin/api/media — JSON list of media assets for the picker dialog.
 *
 * Returns the same data as the media admin page but in a compact JSON shape
 * keyed by asset id. Admin-only — non-admins get 403, unauthenticated 401.
 */

import {
	applyAstropressSecurityHeaders,
	buildMediaPageModel,
	getAccessContext,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Admin JSON response carrying the shared `admin`-area security envelope
 * (Referrer-Policy, X-Content-Type-Options, Permissions-Policy,
 * Cross-Origin-Resource-Policy, CSP, …) plus `private, no-store` cache
 * semantics — applied to success and auth-failure responses alike (#103).
 */
function adminJson(body: unknown, status: number): Response {
	const headers = new Headers({ "content-type": "application/json" });
	applyAstropressSecurityHeaders(headers, { area: "admin" });
	return new Response(JSON.stringify(body), { status, headers });
}

export const GET: APIRoute = async ({ locals }) => {
	const adminUser = locals.adminUser;
	if (!adminUser) {
		return adminJson({ error: "unauthenticated" }, 401);
	}
	// #106: authorize on the same media:list rule the media page + picker use,
	// not the coarse admin break-glass, so the page and its picker API agree.
	const access = await getAccessContext({ locals });
	const decision = access?.can("media:list");
	if (!decision || decision.decision === "deny") {
		return adminJson({ error: "forbidden" }, 403);
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
	return adminJson({ items }, 200);
};
