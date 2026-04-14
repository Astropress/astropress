import type { AnalyticsConfig } from "./config";

/**
 * Resolves the analytics tracking snippet for the configured provider.
 *
 * Returns an HTML string (a `<script>` tag) that should be placed in the
 * `<head>` of the host layout. Returns an empty string if analytics is not
 * configured or if the mode is "iframe" or "link" (embed-only, no snippet).
 *
 * For the "custom" type, the snippet is passed through as-is.
 * For all other types, the snippet is built from the config fields.
 */
export function resolveAnalyticsSnippet(config?: AnalyticsConfig | null): string {
  if (!config) return "";

  switch (config.type) {
    case "umami": {
      if (!config.snippetSrc || !config.siteId) return "";
      return `<script defer src="${escAttr(config.snippetSrc)}" data-website-id="${escAttr(config.siteId)}"></script>`;
    }
    case "plausible": {
      if (!config.snippetSrc || !config.siteId) return "";
      return `<script defer data-domain="${escAttr(config.siteId)}" src="${escAttr(config.snippetSrc)}"></script>`;
    }
    case "matomo": {
      if (!config.url || !config.siteId) return "";
      const trackerUrl = config.url.endsWith("/") ? config.url : `${config.url}/`;
      return [
        `<script>`,
        `var _paq = window._paq = window._paq || [];`,
        `_paq.push(['trackPageView']);`,
        `_paq.push(['enableLinkTracking']);`,
        `(function() {`,
        `  var u="${escJs(trackerUrl)}";`,
        `  _paq.push(['setTrackerUrl', u+'matomo.php']);`,
        `  _paq.push(['setSiteId', '${escJs(config.siteId)}']);`,
        `  var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];`,
        `  g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);`,
        `})();`,
        `</script>`,
      ].join("\n");
    }
    case "posthog": {
      if (!config.snippetSrc || !config.siteId) return "";
      return [
        `<script>`,
        `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){`,
        `function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}`,
        `(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",`,
        `(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);`,
        `var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=u.toString,o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);`,
        `e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||(window.posthog=[]));`,
        `posthog.init('${escJs(config.siteId)}',{api_host:'${escJs(config.url ?? "https://app.posthog.com")}'})`,
        `</script>`,
      ].join("\n");
    }
    case "custom": {
      // Custom snippets are passed through as-is (host is responsible for sanitization)
      return config.snippetSrc ?? "";
    }
    default:
      return "";
  }
}

/**
 * Returns true if the incoming request signals that the user has opted out of
 * tracking, either via the `DNT: 1` (Do Not Track) header or the newer
 * `Sec-GPC: 1` (Global Privacy Control) header.
 *
 * Operators should call this before injecting analytics snippets and skip
 * tracking when it returns `true`.
 *
 * @example
 * ```astro
 * ---
 * import { resolveAnalyticsSnippet, requestOptedOutOfTracking } from "@astropress-diy/astropress/analytics";
 * const snippet = requestOptedOutOfTracking(Astro.request)
 *   ? ""
 *   : resolveAnalyticsSnippet(config.analytics);
 * ---
 * {snippet && <Fragment set:html={snippet} />}
 * ```
 */
export function requestOptedOutOfTracking(request: Request): boolean {
  const dnt = request.headers.get("DNT");
  const gpc = request.headers.get("Sec-GPC");
  return dnt === "1" || gpc === "1";
}

/**
 * Like `resolveAnalyticsSnippet`, but returns an empty string when the request
 * carries a `DNT: 1` or `Sec-GPC: 1` header — honoring the user's opt-out.
 */
export function resolveAnalyticsSnippetConsentAware(
  config: import("./config").AnalyticsConfig | null | undefined,
  request: Request,
): string {
  if (requestOptedOutOfTracking(request)) return "";
  return resolveAnalyticsSnippet(config);
}

/** Escape a string for use inside an HTML attribute value (double-quoted). */
function escAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape a string for embedding as a JS string literal (single-quoted). */
function escJs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}
