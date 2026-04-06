import { applyAstropressSecurityHeaders } from "./security-headers.js";
import type { AstropressSecurityArea, AstropressSecurityHeadersOptions } from "./security-headers";

export interface AstropressSecurityMiddlewareOptions extends AstropressSecurityHeadersOptions {
  adminBasePath?: string;
  resolveArea?: (url: URL) => AstropressSecurityArea;
}

export function resolveAstropressSecurityArea(url: URL, adminBasePath = "/wp-admin"): AstropressSecurityArea {
  if (!url.pathname.startsWith(adminBasePath)) {
    return "public";
  }

  if (
    url.pathname === `${adminBasePath}/login`
    || url.pathname === `${adminBasePath}/reset-password`
    || url.pathname === `${adminBasePath}/accept-invite`
  ) {
    return "auth";
  }

  if (url.pathname.startsWith(`${adminBasePath}/actions/`)) {
    return "api";
  }

  return "admin";
}

export function createAstropressSecurityMiddleware(options: AstropressSecurityMiddlewareOptions = {}) {
  return async ({ url }: { url: URL }, next: () => Promise<Response>) => {
    const response = await next();
    const area = options.resolveArea?.(url) ?? resolveAstropressSecurityArea(url, options.adminBasePath);

    applyAstropressSecurityHeaders(response.headers, {
      area,
      allowInlineStyles: options.allowInlineStyles,
      forceHsts: options.forceHsts,
      frameAncestors: options.frameAncestors,
    });

    return response;
  };
}
