import { applyAstropressSecurityHeaders } from "./security-headers.js";
import type { AstropressSecurityArea, AstropressSecurityHeadersOptions } from "./security-headers";

export interface AstropressSecurityMiddlewareOptions extends AstropressSecurityHeadersOptions {
  adminBasePath?: string;
  resolveArea?: (url: URL) => AstropressSecurityArea;
}

export function resolveAstropressSecurityArea(url: URL, adminBasePath = "/ap-admin"): AstropressSecurityArea {
  if (url.pathname.startsWith("/ap-api/")) {
    return "api";
  }

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
    const requestId = crypto.randomUUID();
    const response = await next();
    const area = options.resolveArea?.(url) ?? resolveAstropressSecurityArea(url, options.adminBasePath);

    applyAstropressSecurityHeaders(response.headers, {
      area,
      allowInlineStyles: options.allowInlineStyles,
      forceHsts: options.forceHsts,
      frameAncestors: options.frameAncestors,
    });

    response.headers.set("X-Request-Id", requestId);
    return response;
  };
}
