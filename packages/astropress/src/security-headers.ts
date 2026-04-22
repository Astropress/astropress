export type AstropressSecurityArea = "admin" | "auth" | "public" | "api";

export interface AstropressSecurityHeadersOptions {
  area?: AstropressSecurityArea;
  allowInlineStyles?: boolean;
  frameAncestors?: "'none'" | "'self'";
  forceHsts?: boolean;
  reportUri?: string;
}

function parseOrigin(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(options: Required<AstropressSecurityHeadersOptions>) {
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

export function createAstropressSecurityHeaders(
  options: AstropressSecurityHeadersOptions = {},
): Headers {
  const resolved: Required<AstropressSecurityHeadersOptions> = {
    area: options.area ?? "public",
    allowInlineStyles: options.allowInlineStyles ?? false,
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

  if (resolved.area === "admin" || resolved.area === "api" || resolved.area === "auth") {
    headers.set("Cross-Origin-Resource-Policy", "same-site");
  }

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

export function applyCacheHeaders(
  headers: Headers,
  area: AstropressSecurityArea = "public",
  publicCacheTtl?: number,
): void {
  if (area === "public") {
    // Public content: short browser cache, longer CDN cache, stale-while-revalidate for background refresh
    const browserTtl = publicCacheTtl ?? 300;
    const cdnTtl = publicCacheTtl != null ? publicCacheTtl * 12 : 3600;
    headers.set("Cache-Control", `public, max-age=${browserTtl}, s-maxage=${cdnTtl}, stale-while-revalidate=86400`);
  } else {
    // Admin, auth, and API responses must never be cached
    headers.set("Cache-Control", "private, no-store");
  }
}

export function applyAstropressSecurityHeaders(
  target: Headers,
  options: AstropressSecurityHeadersOptions = {},
): Headers {
  const generated = createAstropressSecurityHeaders(options);
  generated.forEach((value, key) => {
    target.set(key, value);
  });
  applyCacheHeaders(target, options.area ?? "public");
  return target;
}

export function createAstropressSecureRedirect(
  location: string,
  status = 302,
  options: AstropressSecurityHeadersOptions = {},
): Response {
  const headers = createAstropressSecurityHeaders({ area: "api", ...options });
  headers.set("Location", location);
  return new Response(null, { status, headers });
}

export function isTrustedRequestOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;

  const origin = parseOrigin(request.headers.get("origin"));
  if (origin) return origin.origin === requestOrigin;

  const referer = parseOrigin(request.headers.get("referer"));
  if (referer) return referer.origin === requestOrigin;

  return true;
}

export function isTrustedStrictRequestOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;

  const origin = parseOrigin(request.headers.get("origin"));
  if (origin) return origin.origin === requestOrigin;

  const referer = parseOrigin(request.headers.get("referer"));
  if (referer) return referer.origin === requestOrigin;

  return false;
}
