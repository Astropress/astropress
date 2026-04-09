function buildContentSecurityPolicy(options) {
  const styleSource = options.allowInlineStyles ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const objectSource = options.area === "public" ? "object-src 'self'" : "object-src 'none'";
  const formAction = options.area === "public" ? "form-action 'self' https:" : "form-action 'self'";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `frame-ancestors ${options.frameAncestors}`,
    formAction,
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    "media-src 'self' data: https:",
    "script-src 'self' https://challenges.cloudflare.com",
    styleSource,
    objectSource,
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ];
  if (options.reportUri) {
    directives.push(`report-uri ${options.reportUri}`, `report-to csp-endpoint`);
  }
  return directives.join("; ");
}

function parseOrigin(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function createAstropressSecurityHeaders(options = {}) {
  const resolved = {
    area: options.area ?? "public",
    allowInlineStyles: options.allowInlineStyles ?? true,
    frameAncestors: options.frameAncestors ?? "'none'",
    forceHsts: options.forceHsts ?? false,
    reportUri: options.reportUri ?? "",
  };
  const headers = new Headers();
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(resolved));
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", resolved.frameAncestors === "'none'" ? "DENY" : "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (resolved.forceHsts) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (resolved.reportUri) {
    headers.set(
      "Report-To",
      JSON.stringify({ group: "csp-endpoint", max_age: 86400, endpoints: [{ url: resolved.reportUri }] }),
    );
  }
  return headers;
}

export function applyCacheHeaders(headers, area = "public") {
  if (area === "public") {
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  } else {
    headers.set("Cache-Control", "private, no-store");
  }
}

export function applyAstropressSecurityHeaders(target, options = {}) {
  const generated = createAstropressSecurityHeaders(options);
  generated.forEach((value, key) => {
    target.set(key, value);
  });
  applyCacheHeaders(target, options.area ?? "public");
  return target;
}

export function createAstropressSecureRedirect(location, status = 302, options = {}) {
  const headers = createAstropressSecurityHeaders({ area: "api", ...options });
  headers.set("Location", location);
  return new Response(null, { status, headers });
}

export function isTrustedRequestOrigin(request) {
  const requestUrl = parseOrigin(request.url);
  if (!requestUrl) {
    return false;
  }
  const origin = parseOrigin(request.headers.get("origin"));
  if (origin) {
    return origin.origin === requestUrl.origin;
  }
  const referer = parseOrigin(request.headers.get("referer"));
  if (referer) {
    return referer.origin === requestUrl.origin;
  }
  return true;
}
