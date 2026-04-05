# Astropress

Astropress is a low-carbon web app framework for individuals and small organizations building relatively simple websites that can be hosted freely or cheaply on common providers. It includes a non-technical admin layer and WordPress migration paths, but it is not intended to become a generic drag-everything-into-it website builder the way WordPress often does in practice.

Current repository shape:

- `packages/astropress` — published npm package
- `crates/astropress-cli` — Rust CLI crate
- `examples/github-pages` — static example site plus docs/admin explainer for GitHub Pages
- `SPEC.md` — production architecture contract
- `features/` — BDD source of truth

Product boundary:

- Astropress is for editorial, informational, campaign, brochure, blog, and other relatively simple organization or individual sites
- Astropress is not trying to be a universal generic website builder for every kind of arbitrary business workflow
- Astropress treats the site as an application with a clear content model, admin model, and provider model

Authoring model:

- production source of truth is a database-backed CMS
- git sync is for export, backup, review, and static-host deployment workflows
- provider adapters are first-party for GitHub Pages, Cloudflare, Supabase, and Runway

CLI delivery model:

- the CLI is authored as a Cargo crate
- the npm package exposes an `astropress` wrapper command
- the wrapper can use `ASTROPRESS_CLI_BIN` for a prebuilt binary or fall back to `cargo run` in-repo

Development:

- `bun install`
- `bun run test`
- `bun run test:cli`
- `bun run test:example`

Specs:

- org-level: `SPEC.md`
- package: `packages/astropress/SPEC.md`
- CLI: `crates/astropress-cli/SPEC.md`
- example/docs: `examples/github-pages/SPEC.md`

Planning docs:

- org layout and split strategy: `docs/ORG_LAYOUT.md`
- local split map: `docs/LOCAL_SPLIT.md`
- consumer migration map: `docs/CONSUMER_MIGRATION.md`
- GitHub bootstrap status: `docs/GITHUB_BOOTSTRAP.md`

Host integration helpers:

- `astropress/integration` re-exports the current Vite, Vitest, and host-runtime helper surface from one place
- `astropress/hosted-platform-adapter` exposes the package-owned assembler for hosted providers built from explicit store modules
- `astropress/adapters/sqlite`, `astropress/adapters/local`, `astropress/adapters/hosted`, `astropress/adapters/project`, `astropress/adapters/cloudflare`, `astropress/adapters/supabase`, and `astropress/adapters/runway` expose first-party provider adapter factories
- `astropress/provider-choice` exposes the package-owned provider recommendation helper used by scaffolding, docs, and future setup flows
- `astropress/project-launch` exposes the package-owned runtime/bootstrap plan used by local dev startup and future hosted boot flows
- `astropress/adapters/supabase-sqlite` and `astropress/adapters/runway-sqlite` expose Node-only local runtimes for those providers backed by the packaged SQLite adapter
- Supabase and Runway hosted config loading now lives in Astropress too via `readAstropressSupabaseHostedConfig`, `createAstropressSupabaseHostedAdapter`, `readAstropressRunwayHostedConfig`, and `createAstropressRunwayHostedAdapter`
- `astropress/deploy/github-pages`, `astropress/import/wordpress`, and `astropress/sync/git` expose the Node-only deploy/import/sync workflow helpers as stable package entry points
- `astropress/cloudflare-vite-integration` composes the Cloudflare-specific local-runtime stub aliases and resolver
- `astropress/vite-integration` composes the standard Vite plugin and alias rules into one helper
- `astropress/vite-runtime-alias` exposes reusable Vite alias/plugin helpers for `local-runtime-modules`
- `astropress/vitest-runtime-alias` exposes reusable Vitest plugin helpers for external-package test runs
- `astropress/local-runtime-modules` exposes the typed seam contract for host implementations
- `astropress/cloudflare-workers-stub` and `astropress/cloudflare-local-runtime-stubs` are exported as stable package entry points
- current host-facing runtime modules are also exported as stable subpaths so consuming apps can stop using repo-relative `src` paths during extraction
- `registerCms({ admin: ... })` lets hosts override package-owned admin branding, labels, nav names, favicon, logo assets, and an optional custom admin stylesheet without forking the admin app

Current package-owned runtime surfaces:

- `astropress/adapters/sqlite` is now a real SQLite-backed provider adapter
- `astropress/hosted-platform-adapter` is the stable assembly surface for Supabase-, Runway-, or custom-style hosted providers built from explicit content/media/revision/auth stores
- `astropress/adapters/local` selects the local SQLite-backed provider runtime from explicit options or `ASTROPRESS_LOCAL_PROVIDER`
- `astropress/adapters/hosted` selects the hosted Supabase or Runway adapter from explicit options or `ASTROPRESS_HOSTED_PROVIDER`
- `astropress/adapters/project` selects local or hosted runtime mode from explicit options or `ASTROPRESS_RUNTIME_MODE`
- both selector surfaces now accept an explicit `env` map, so startup code can resolve providers from package-owned env contracts without mutating `process.env`
- `astropress/adapters/supabase-sqlite` and `astropress/adapters/runway-sqlite` wrap that packaged SQLite runtime behind provider-specific capabilities for local development
- Supabase and Runway hosted adapters can now load and validate their provider env config inside Astropress before building hosted-store adapters
- `astropress/sqlite-bootstrap` exposes the packaged schema/bootstrap toolkit for local admin databases
- `astropress/sqlite-admin-runtime` exposes the packaged Node SQLite admin runtime
- those Node-only SQLite entry points stay off the root `astropress` API and are stubbed out of Cloudflare builds

Current CLI workflow behavior:

- `astropress new` scaffolds the example site and writes local SQLite defaults in `.env` and `.data/`
- `astropress new --provider sqlite|supabase|runway` scaffolds the example site with a matching local provider default in `.env`
- `astropress dev --provider sqlite|supabase|runway` seeds the matching local SQLite-backed provider runtime before starting the site
- `astropress import wordpress`, `astropress sync export`, `astropress sync import`, and GitHub Pages deploy now call the packaged Astropress workflow modules rather than duplicating those workflows in Rust
- the package-owned provider recommendation defaults to Cloudflare for most non-technical users, while treating GitHub Pages as a static deploy target rather than the canonical write runtime

Why there are duplicated `src/*.ts` and `src/*.js` files:

- the TypeScript files are the source of truth for typed development inside the repo
- the matching JavaScript files exist for runtime entry points that must load directly from `node_modules` in Bun/Node without a TypeScript build step
- this is deliberate package-boundary plumbing, not two independent implementations
- the JS entry points keep tarball consumers and config-time imports working while Astropress is still distributed as source plus selected runtime JS shims

Why `local-runtime-modules` exists:

- Astropress is intended to be reusable, but the actual admin store, auth backend, CMS registry, and local asset readers are host-app concerns until the full provider adapter layer is finished.
- `local-runtime-modules` is the temporary boundary that lets the reusable package dynamically load those host-owned implementations without hard-coding Fleet-specific files into the package.
- In development and test, the host app aliases `./local-runtime-modules` to its own implementation file.
- In Cloudflare-style builds, the host can instead point that import at `astropress/cloudflare-local-runtime-stubs` so unsupported local fallbacks fail explicitly.
- The host-side implementation shape is now documented and typed through `astropress/host-runtime-modules`.

Admin customization example:

```ts
registerCms({
  siteUrl: "https://example.org",
  templateKeys: ["home"],
  seedPages: [],
  archives: [],
  translationStatus: [],
  admin: {
    branding: {
      appName: "Client Console",
      productName: "Client Console Admin",
      shellName: "Client Workspace",
      logoSrc: "/brand/admin-mark.svg",
      faviconHref: "/brand/favicon.ico",
      stylesheetHref: "/brand/admin.css",
    },
    labels: {
      sidebarTitle: "Operations",
      signOut: "Log out",
      loginHeading: "Client sign in",
    },
    navigation: {
      routePages: "Page Routes",
      media: "Asset Library",
    },
  },
});
```
