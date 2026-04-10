# Quick Start

Get a working astropress site with an admin panel in under 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- Node.js 22+ (for `node:sqlite` fallback — Bun's built-in SQLite is preferred)

## 1. Scaffold a new project

```bash
bun create astropress my-site
cd my-site
```

The scaffold creates:

```
my-site/
  src/
    astropress/
      local-runtime-modules.ts  ← host-app runtime seam (SQLite by default)
      admin-auth.ts
      admin-persistence.ts
      admin-store.ts
  astro.config.mjs
  .env.example
  package.json
```

## 2. Set up environment variables

```bash
cp .env.example .env
```

The default `.env` for local development:

```
ASTROPRESS_ADMIN_EMAIL=admin@example.com
ASTROPRESS_ADMIN_PASSWORD=changeme
ASTROPRESS_DATABASE_PATH=.data/admin.sqlite
```

## 3. Start the dev server

```bash
bun dev
```

Open http://localhost:4321/ap-admin — log in with the credentials from your `.env`.

## 4. What you get out of the box

- `/ap-admin` — full content admin: pages, posts, media, redirects, comments, authors, SEO
- `/ap-admin/login` — session-based auth (no third-party service required)
- SQLite database at `.data/admin.sqlite` — zero external dependencies for local dev
- Theme toggle, confirm dialogs, HTML editor — all native Web Components (`<ap-theme-toggle>`, `<ap-confirm-dialog>`, `<ap-html-editor>`)

## 5. The Vite alias seam

Astropress ships a package that contains the entire admin UI, but **the admin UI cannot know at build time** which database or runtime your host app uses (SQLite vs. Cloudflare D1 vs. Supabase).

The seam is resolved through a Vite alias:

```
Astro build
  → Vite
    → alias: "local-runtime-modules"
      → src/astropress/local-runtime-modules.ts  (your host app)
```

The package imports `import { ... } from "local-runtime-modules"` and Vite resolves it to whatever file `local-runtime-modules` points to in your project. This means:

- Switch from SQLite to Cloudflare? Update `local-runtime-modules.ts` + `astro.config.mjs`
- No admin templates or components need to change.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture.

## 6. Add to an existing Astro site

```bash
bun add astropress
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import { astropressIntegration } from "astropress";

export default defineConfig({
  integrations: [astropressIntegration()],
});
```

```ts
// src/astropress/local-runtime-modules.ts
// Implement the LocalRuntimeModules contract for your runtime.
export { createSqliteAdminRuntime as createAdminRuntime } from "astropress/adapters/sqlite";
```

## The 6 imports you need

```ts
// astro.config.mjs — wire astropress into Astro
import { createAstropressAdminAppIntegration } from "astropress/integration";

// src/astropress/local-runtime-modules.ts — host-side DB/auth seam
import { selectAstropressAdapter } from "astropress/adapters/project";

// src/middleware.ts — security headers + CSRF + rate limiting
import { astropressSecurityMiddleware } from "astropress/security";

// astropress.config.ts — register content types and features
import { registerCms } from "astropress";

// any server file — inspect APP_HOST / CONTENT_SERVICES env vars
import { resolveProjectEnv } from "astropress/project-env";

// src/adapters/my-adapter.ts — build a custom runtime adapter
import type { AstropressProviderContract } from "astropress/platform-contracts";
```

## Next steps

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the provider seam works
- [WEB_COMPONENTS.md](./WEB_COMPONENTS.md) — built-in web components and how to extend them
- [EVALUATION.md](./EVALUATION.md) — how well astropress does what it claims
