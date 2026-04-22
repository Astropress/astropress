/**
 * Admin preview middleware — guards /ap-admin/preview/* paths so that only
 * authenticated admin/editor users can view draft content.
 *
 * This middleware intercepts preview routes and checks for a valid admin
 * session before forwarding the request. Unauthenticated requests are
 * redirected to the admin login page.
 */

export interface AdminPreviewRequest {
	url: URL;
	headers: Headers;
	cookies?: { get(name: string): { value?: string } | undefined };
}

export interface AdminPreviewContext {
	sessionCookie?: string;
	isPreviewPath: boolean;
}

/**
 * Resolve the preview path context from a request URL.
 * Returns the content slug to preview, or null if this is not a preview request.
 */
export function resolvePreviewPath(url: URL): { slug: string } | null {
	const match = url.pathname.match(/^\/ap-admin\/preview\/(.+)$/);
	if (!match) {
		return null;
	}
	return { slug: match[1] };
}

/**
 * Build a redirect URL for the admin login page, preserving the return path.
 */
export function buildPreviewLoginRedirect(requestUrl: URL): string {
	const returnPath = encodeURIComponent(
		requestUrl.pathname + requestUrl.search,
	);
	return `/ap-admin/login?return=${returnPath}`;
}
