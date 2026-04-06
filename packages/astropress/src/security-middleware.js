import { applyAstropressSecurityHeaders } from "./security-headers.js";

export function resolveAstropressSecurityArea(url, adminBasePath = "/wp-admin") {
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

export function createAstropressSecurityMiddleware(options = {}) {
  return async ({ url }, next) => {
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
