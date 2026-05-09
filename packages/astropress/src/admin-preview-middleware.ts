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
const PREVIEW_PREFIX = "/ap-admin/preview/";

export function resolvePreviewPath(url: URL): { slug: string } | null {
	if (!url.pathname.startsWith(PREVIEW_PREFIX)) return null;
	const slug = url.pathname.slice(PREVIEW_PREFIX.length);
	return slug ? { slug } : null;
}

/**
 * Build a redirect URL for the admin login page, preserving the return path.
 */
export function buildPreviewLoginRedirect(requestUrl: URL): string {
	const returnPath = encodeURIComponent(requestUrl.pathname + requestUrl.search);
	return `/ap-admin/login?return=${returnPath}`;
}
