# Two-site deployment pattern (the Astropress default)

Astropress is designed around a **two-site deployment topology**:

| Site | Astro output | Integration | Typical host | Purpose |
|------|--------------|-------------|--------------|---------|
| **Admin / test** | `server` | `createAstropressAdminAppIntegration()` | Cloudflare, Vercel, Netlify, Render, or a private VM | Authoring surface. Editors sign in to `/ap-admin`, write content, and preview changes. |
| **Public / production** | `static` | `createAstropressPublicSiteIntegration()` | GitHub Pages, GitLab Pages, Cloudflare Pages, any static host | The domain your readers see. Zero admin surface, zero auth, zero dynamic routes. |

The two sites can live in the **same repository** (two `astro.config.*.mjs` files) or in **two separate repositories** wired together by a build hook.

This split is not decorative. The production static bundle literally cannot serve `/ap-admin/*`, so no matter how misconfigured the CDN or ingress gets, an attacker has nothing to attack.

## Why two sites?

1. **Attack surface.** An admin panel is stateful, session-backed, and full of write paths. A static site is bytes on disk. Keeping the two on separate origins means a defect in the admin never exposes the public domain, and a misrouted request from the public CDN cannot reach admin code.
2. **Availability.** Static prod keeps serving even when the admin host is down for maintenance, scaling, or a failed deploy.
3. **Cost & ops.** The admin runs at low concurrency (editors, not readers). Static prod scales trivially on the cheapest tier of any CDN.
4. **Governance.** Publishing is an explicit event (a build), not a silent DB update. Every production change leaves a deployable artifact.

## Topology A — two configs in one repo

This is the default the `astropress new` scaffold emits for server-output hosts.

```
your-site/
├── astro.config.mjs           # admin + server output (test env)
├── astro.config.public.mjs    # public-site + static output (prod)
├── package.json               # includes both `build` and `build:public` scripts
└── src/
    └── ...
```

Deploy flow:

1. **Test env (admin):** CI runs `bun run build` and deploys the server bundle to the admin host (`admin.your-site.example`).
2. **Production (static):** CI runs `bun run build:public` and deploys `dist/` to the public host (`your-site.example`). No admin routes ship.

The two deploys can share the same pipeline or fire independently — for example, `build:public` can be wired to a `repository_dispatch` event that fires when an editor clicks **Publish** in the admin.

### package.json scripts

The scaffold adds:

```json
{
  "scripts": {
    "build": "astro build",
    "build:public": "astro build --config astro.config.public.mjs"
  }
}
```

### astro.config.mjs (admin / test)

```js
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createAstropressViteIntegration, createAstropressAdminAppIntegration } from "astropress/integration";

const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath: fileURLToPath(new URL("./src/astropress/local-runtime-modules.ts", import.meta.url)),
});

export default defineConfig({
  output: "server",
  integrations: [createAstropressAdminAppIntegration()],
  vite: { plugins: viteIntegration.plugins, resolve: { alias: viteIntegration.aliases } },
});
```

### astro.config.public.mjs (public / prod)

```js
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createAstropressViteIntegration, createAstropressPublicSiteIntegration } from "astropress/integration";

const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath: fileURLToPath(new URL("./src/astropress/local-runtime-modules.ts", import.meta.url)),
});

export default defineConfig({
  output: "static",
  integrations: [createAstropressPublicSiteIntegration()],
  vite: { plugins: viteIntegration.plugins, resolve: { alias: viteIntegration.aliases } },
});
```

The `createAstropressPublicSiteIntegration()` helper injects only `/sitemap.xml`, `/robots.txt`, and `/llms.txt`. It registers **zero** `/ap-admin/*` routes and **zero** security middleware, because there is nothing to secure. This invariant is enforced by `tooling/bdd/deploy/domain-separation.feature`.

## Topology B — two repositories

If you already operate content in one repository and a public marketing site in another, or if you want the strongest possible separation, split the scaffold into two:

```
acme-admin/   (server output, admin host)
  astro.config.mjs        ← uses createAstropressAdminAppIntegration
acme-public/  (static output, prod host)
  astro.config.mjs        ← uses createAstropressPublicSiteIntegration
```

Wire the two with a webhook:

1. In `acme-admin`, the **Publish** action calls `POST https://api.github.com/repos/acme/acme-public/dispatches` with an `event_type` of `astropress-publish` and a PAT in the `Authorization` header.
2. `acme-public` has a workflow triggered on `repository_dispatch: types: [astropress-publish]` that pulls the latest content over the Astropress content API and rebuilds `dist/`.

A minimal `acme-public/.github/workflows/publish.yml`:

```yaml
name: Publish
on:
  repository_dispatch:
    types: [astropress-publish]
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
        env:
          ASTROPRESS_CONTENT_API_URL: ${{ secrets.ASTROPRESS_CONTENT_API_URL }}
          ASTROPRESS_CONTENT_API_TOKEN: ${{ secrets.ASTROPRESS_CONTENT_API_TOKEN }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

`acme-public` does not need a copy of the admin codebase. It pulls content at build time and renders it through its own Astro pages.

## Choosing between A and B

- **Start with topology A** if you only have one team, one repo, and one CI pipeline. It is the least ceremony and still gives you a zero-admin production bundle.
- **Migrate to topology B** when any of the following is true: the public repo is handled by a different team; production has compliance requirements that forbid admin code even at rest in the repo; you want cache-warm static deploys to keep firing even during an admin-side outage.

Both topologies pass the `Admin and production domain separation` BDD feature — the integration-level invariants are the same either way.

## Local development

For local work, run the admin config:

```sh
bun run dev          # http://localhost:4321, admin at /ap-admin
```

To sanity-check the public static bundle locally:

```sh
bun run build:public        # writes dist/
bunx serve dist             # serve the static output
```

You should see **no** `/ap-admin` routes in the static bundle, and `dist/` should contain `sitemap.xml`, `robots.txt`, and `llms.txt`.

## Security posture summary

- Admin host: authentication + CSRF + ZTA middleware + full security headers (see `docs/adr/0003-zta-admin-form-actions.md`).
- Public host: no auth, no dynamic routes, no write paths. Security headers are emitted as `<meta>` tags where applicable; the CDN enforces HSTS, CSP, and cache policy.
- The two hosts should run on **different origins** (`admin.example.com` vs `example.com`) so cookies cannot leak across boundaries.
