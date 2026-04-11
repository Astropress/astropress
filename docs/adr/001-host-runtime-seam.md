# ADR-001: Host Runtime Seam via Vite Alias

**Date:** 2024-11-01
**Status:** Accepted

## Context

Astropress ships an admin panel and REST API as a reusable npm package. However, the storage layer for content, media, auth, and sessions is *not* a package concern — it depends on where the host application runs (local SQLite, Cloudflare D1, Supabase Postgres, etc.).

The package needed a way to import host-provided runtime modules without knowing at package-build time which runtime the host would use.

Options considered:
1. **Constructor injection** — pass runtime adapters as arguments to `registerCms()`. Simple, but requires the host to pass the same adapter to every page that imports from `astropress`.
2. **Global registry** — `registerCms()` stores the adapter in a global map keyed by singleton. Simple, but module isolation in Vite and SSR can produce multiple instances.
3. **Vite alias** — the package imports `"local-runtime-modules"` and the host maps this virtual module to their actual implementation via Vite's `resolve.alias`. This resolves at build time and produces zero runtime overhead.

## Decision

Use a **Vite alias** (`"local-runtime-modules"`) as the host-runtime seam. The package imports from `"local-runtime-modules"` as if it were a normal npm package. The host app configures Vite to resolve that alias to its own runtime implementation file.

```js
// astro.config.mjs (host app)
import { createAstropressViteIntegration } from "astropress/vite-integration";

export default defineConfig({
  vite: {
    plugins: [createAstropressViteIntegration({ localRuntimeModules: "./src/astropress/local-runtime-modules.ts" })]
  }
});
```

In Cloudflare builds, the alias points to `astropress/cloudflare-local-runtime-stubs` so that unsupported local fallbacks fail explicitly with descriptive errors rather than silently.

## Consequences

**Positive:**
- Zero runtime overhead — alias is resolved at build time
- Works in any Astro deployment target (Node, Cloudflare Workers, Bun, Deno)
- Host can switch runtime (SQLite → D1) by changing one alias + restarting
- Package tests use a Vitest plugin that resolves the same alias to a test-double implementation
- No admin templates or components need to change when switching runtimes

**Negative:**
- Non-obvious for developers encountering it for the first time
- Must document the alias pattern clearly — `astropress doctor` warns when the alias is missing
- CI must resolve the alias for test runs (via `vitest-runtime-alias`)
