# Analytics

Astropress supports first-party, self-hosted analytics — no tracking forced
on your visitors. Analytics is opt-in and off by default.

## Configure a provider

Pass an `analytics` object to `registerCms()`:

```ts
// astropress.config.ts
import { registerCms } from "astropress";

registerCms({
  siteUrl: "https://example.org",
  analytics: {
    type: "umami",         // umami | plausible | matomo | posthog | custom
    mode: "snippet-only",  // iframe | link | snippet-only
    snippetSrc: "https://analytics.example.com/script.js",
    siteId: "your-website-id",
  },
});
```

Then inject the snippet in your public layout:

```astro
---
// src/layouts/PublicLayout.astro
import { resolveAnalyticsSnippetConsentAware } from "astropress/analytics";
import { peekCmsConfig } from "astropress";

const config = peekCmsConfig();
const snippet = resolveAnalyticsSnippetConsentAware(
  config?.analytics,
  Astro.request,
);
---
<html>
  <head>
    <!-- ... -->
    {snippet && <Fragment set:html={snippet} />}
  </head>
```

`resolveAnalyticsSnippetConsentAware` automatically returns an empty string
when the visitor sends `DNT: 1` or `Sec-GPC: 1` — no extra check needed.

---

## Providers

### Umami

Self-hosted, lightweight (~2 KB script), privacy-first.
[umami.is](https://umami.is) — Docker one-liner, MIT license.

```ts
analytics: {
  type: "umami",
  mode: "snippet-only",
  snippetSrc: "https://your-umami.example.com/script.js",
  siteId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
}
```

Generated snippet:
```html
<script defer
  src="https://your-umami.example.com/script.js"
  data-website-id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
</script>
```

---

### Plausible

~1 KB script, excellent UI, cloud or self-hosted, EU-hosted option.
[plausible.io](https://plausible.io)

```ts
analytics: {
  type: "plausible",
  mode: "snippet-only",
  snippetSrc: "https://plausible.io/js/script.js",
  siteId: "example.com",  // your domain
}
```

Generated snippet:
```html
<script defer
  data-domain="example.com"
  src="https://plausible.io/js/script.js">
</script>
```

---

### Matomo

Full Google Analytics replacement with GDPR compliance features.
Self-hosted or Matomo Cloud. [matomo.org](https://matomo.org)

```ts
analytics: {
  type: "matomo",
  mode: "snippet-only",
  url: "https://your-matomo.example.com",
  siteId: "1",  // numeric site ID from Matomo admin
}
```

Astropress builds the full Matomo tracking snippet from `url` and `siteId`.
No copy-pasting from the Matomo dashboard needed.

---

### PostHog

Product analytics + session replay + feature flags. Self-hostable.
[posthog.com](https://posthog.com)

```ts
analytics: {
  type: "posthog",
  mode: "snippet-only",
  snippetSrc: "https://eu.i.posthog.com/static/array.js",
  siteId: "phc_xxxxxxxxxxxx",          // PostHog project API key
  url: "https://eu.i.posthog.com",     // optional; defaults to app.posthog.com
}
```

---

### Custom

Use `type: "custom"` for any analytics tool not in the list above —
Fathom, Pirsch, Cabin, OpenPanel, or a custom internal tracker.

Set `snippetSrc` to the full `<script>` tag (or any HTML) you want
injected. The framework passes it through verbatim — you own sanitization.

```ts
analytics: {
  type: "custom",
  mode: "snippet-only",
  snippetSrc: `<script defer
    src="https://cdn.fathom.com/script.js"
    data-site="ABCDEFGH">
  </script>`,
}
```

```ts
// Cabin (no external requests, privacy-focused)
analytics: {
  type: "custom",
  mode: "snippet-only",
  snippetSrc: `<script async src="https://scripts.cabin.dev/cabin.js"></script>`,
}
```

**Security note:** unlike the named providers, `custom` snippets are not
escaped by the framework. Do not interpolate untrusted values into the
`snippetSrc` string.

---

## Admin panel link (iframe or link mode)

If your analytics tool has a web dashboard, you can surface it inside
the Astropress admin:

```ts
analytics: {
  type: "umami",
  mode: "iframe",              // embed dashboard in /ap-admin/services/analytics
  url: "https://analytics.example.com",
  siteId: "your-website-id",
  label: "Analytics",          // optional; overrides sidebar label
}
```

Or just a link:

```ts
analytics: {
  type: "plausible",
  mode: "link",
  url: "https://plausible.io/your-domain.com",
  snippetSrc: "https://plausible.io/js/script.js",
  siteId: "your-domain.com",
}
```

`mode: "snippet-only"` injects the tracker without any admin panel entry.
`mode: "iframe"` or `mode: "link"` both add an Analytics entry to the
admin sidebar, and can also inject a snippet if `snippetSrc` is set.

---

## Consent banner

Use `<AstropressConsentBanner>` to gate analytics behind an explicit
opt-in. The component is a sticky footer dialog — it stores the user's
choice in `localStorage` and dispatches a `CustomEvent("ap-consent-accepted")`.

```astro
---
import { AstropressConsentBanner } from "astropress/components";
---
<!-- Place at the end of your layout's <body> -->
<AstropressConsentBanner
  message="We use privacy-respecting analytics."
  accept-label="Accept"
  decline-label="No thanks"
/>
```

After the user accepts, reload the analytics snippet dynamically:

```html
<script>
  window.addEventListener("ap-consent-accepted", () => {
    // re-run your analytics init here, or reload the page
  });
</script>
```

The banner hides automatically on return visits when consent has already
been recorded.

---

## Honoring DNT and GPC

`resolveAnalyticsSnippetConsentAware()` checks `DNT: 1` and `Sec-GPC: 1`
request headers and returns an empty string when either is present.
This happens server-side, so no tracker script is even sent to the browser.

To check DNT/GPC manually:

```ts
import {
  requestOptedOutOfTracking,
  resolveAnalyticsSnippet,
} from "astropress/analytics";

const snippet = requestOptedOutOfTracking(Astro.request)
  ? ""
  : resolveAnalyticsSnippet(config?.analytics);
```

---

## A/B testing and feature flags

```ts
import { registerCms } from "astropress";

registerCms({
  abTesting: {
    type: "growthbook",         // growthbook | unleash | custom
    mode: "iframe",
    url: "https://app.growthbook.io",
    apiEndpoint: "https://cdn.growthbook.io/api/features/sdk-xxx",
  },
});
```

The `abTesting` config adds a Feature Flags entry to the admin sidebar
in `iframe` or `link` mode. The framework does not inject A/B testing
client scripts — wire those from your public layout using `apiEndpoint`.

---

## Environment variable scaffolding

`astropress new` generates `.env.example` entries for the chosen analytics
provider. Example for Umami:

```
# Analytics (Umami)
ASTROPRESS_ANALYTICS_TYPE=umami
ASTROPRESS_ANALYTICS_SNIPPET_SRC=https://your-umami.example.com/script.js
ASTROPRESS_ANALYTICS_SITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Read these in `astropress.config.ts`:

```ts
registerCms({
  analytics: {
    type: (process.env.ASTROPRESS_ANALYTICS_TYPE as AnalyticsConfig["type"])
      ?? "umami",
    mode: "snippet-only",
    snippetSrc: process.env.ASTROPRESS_ANALYTICS_SNIPPET_SRC,
    siteId: process.env.ASTROPRESS_ANALYTICS_SITE_ID,
  },
});
```
