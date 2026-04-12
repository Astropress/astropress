# Quick Start

Get a working astropress site with an admin panel in under 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- Node.js 20+

The bundled installer provisions all prerequisites automatically:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/astropress/astropress/main/tooling/scripts/install.sh)
```

## 1. Scaffold a new project

```bash
astropress new my-site
cd my-site
```

`astropress init` is an alias for `astropress new`:

```bash
astropress init my-site
# equivalent to: astropress new my-site
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
ADMIN_PASSWORD=changeme
ADMIN_DB_PATH=.data/admin.sqlite
SESSION_SECRET=replace-with-a-long-random-session-secret
```

## 3. Start the dev server

```bash
astropress dev
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

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full picture.

## 6. Add to an existing Astro site

```bash
bun add astropress
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import { createAstropressAdminAppIntegration, createAstropressViteIntegration } from "astropress/integration";

const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath: new URL("./src/astropress/local-runtime-modules.ts", import.meta.url).pathname,
});

export default defineConfig({
  integrations: [createAstropressAdminAppIntegration()],
  vite: {
    plugins: viteIntegration.plugins,
    resolve: { alias: viteIntegration.aliases },
  },
});
```

```ts
// src/astropress/local-runtime-modules.ts
// Implement the host-side runtime seam — swap this to change your storage backend.
import { createAstropressSqliteAdapter } from "astropress/adapters/sqlite";
export const createAdminRuntime = () => createAstropressSqliteAdapter({ dbPath: ".data/admin.sqlite" });
```

## The key imports

```ts
// astro.config.mjs — Wire the admin app and Vite aliases into Astro
import { createAstropressAdminAppIntegration, createAstropressViteIntegration } from "astropress/integration";

// src/astropress/local-runtime-modules.ts — Host-side DB/auth seam; swap to change your runtime
import { createAstropressProjectAdapter } from "astropress/adapters/project";

// src/middleware.ts — Security headers, CSRF protection, rate limiting
import { createAstropressSecurityMiddleware } from "astropress/integration";

// astropress.config.ts — Register content types, analytics, plugins, locales, and admin branding
import { registerCms } from "astropress";

// any server file — Read APP_HOST / CONTENT_SERVICES env vars
import { resolveAstropressProjectEnvContract } from "astropress/project-env";

// src/adapters/my-adapter.ts — Implement this interface to build a custom storage backend
import type { AstropressPlatformAdapter } from "astropress";
```

## `astropress doctor` output

Run `astropress doctor` to check your project setup:

```
astropress doctor
✓ ASTROPRESS_APP_HOST: cloudflare-pages
✓ ASTROPRESS_CONTENT_SERVICES: supabase
✓ SESSION_SECRET is set (≥ 32 chars)
✓ ADMIN_DB_PATH: .data/admin.sqlite
✓ .data directory exists
⚠ ADMIN_BOOTSTRAP_DISABLED is 0 — bootstrap passwords are still available
```

Use `astropress doctor --json` for machine-readable output:

```json
{
  "status": "warn",
  "project": "/path/to/my-site",
  "runtimeMode": "local",
  "appHost": "cloudflare-pages",
  "contentServices": "supabase",
  "pairSupport": "sqlite-local",
  "adminLocale": "en",
  "checks": [
    { "key": "SESSION_SECRET", "status": "ok" },
    { "key": "ADMIN_DB_PATH", "status": "ok", "value": ".data/admin.sqlite" },
    { "key": "ADMIN_BOOTSTRAP_DISABLED", "status": "warn", "message": "bootstrap passwords remain available" }
  ],
  "warnings": [
    "ADMIN_BOOTSTRAP_DISABLED is 0 — bootstrap passwords are still available"
  ]
}
```

## Troubleshooting

**"SESSION_SECRET is missing or too short"**
Set a strong random secret in `.env`: `SESSION_SECRET=$(openssl rand -hex 32)`

**"ADMIN_PASSWORD is a scaffold-style local default"**
Change your admin password: `astropress doctor` warns when the default scaffold passwords are still in use. Update `ADMIN_PASSWORD` in `.env` and restart the dev server.

**Admin panel shows a blank page or 500 error**
Run `astropress doctor --strict` — this surfaces any missing env vars or schema mismatches that would cause admin page model failures.

**"`.data` directory does not exist"**
Create it: `mkdir -p .data && touch .data/.gitkeep`. The directory holds the local SQLite database.

**"local-runtime-modules not found"**
The host app must alias `local-runtime-modules` in `astro.config.mjs` to its own runtime implementation. See [ARCHITECTURE.md](../ARCHITECTURE.md).

## Next steps

| Topic | Doc |
|-------|-----|
| How the provider seam works | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Analytics, consent banner, custom snippets | [ANALYTICS.md](./ANALYTICS.md) |
| Built-in web components and how to extend them | [WEB_COMPONENTS.md](../reference/WEB_COMPONENTS.md) |
| Import from WordPress or Wix; content scheduling | [OPERATIONS.md](./OPERATIONS.md) |
| GDPR data inventory and right of erasure | [COMPLIANCE.md](./COMPLIANCE.md) |
| Multilingual sites and admin UI labels | [MULTILINGUAL.md](./MULTILINGUAL.md) |
