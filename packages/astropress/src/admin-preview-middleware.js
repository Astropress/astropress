/**
 * Resolve the preview path context from a request URL.
 * Returns the content slug to preview, or null if this is not a preview request.
 */
export function resolvePreviewPath(url) {
  const match = url.pathname.match(/^\/ap-admin\/preview\/(.+)$/);
  if (!match) {
    return null;
  }
  return { slug: match[1] };
}

/**
 * Build a redirect URL for the admin login page, preserving the return path.
 */
export function buildPreviewLoginRedirect(requestUrl) {
  const returnPath = encodeURIComponent(requestUrl.pathname + requestUrl.search);
  return `/ap-admin/login?return=${returnPath}`;
}
