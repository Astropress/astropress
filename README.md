# Astropress

Astropress is an opinionated web app framework for individuals and small organizations building relatively simple websites. It is for editorial, informational, campaign, brochure, and blog sites that need a real admin and a clear content model. It is not trying to become a generic drag-and-drop website builder or a plugin-shaped abstraction layer for arbitrary business workflows.

Current release posture:

- local SQLite-backed runtime: supported reference path
- GitHub Pages static public output: supported
- WordPress staged import artifacts and local SQLite apply flow: supported
- split `App Host` plus `Content Services` deployment model: supported
- Cloudflare Pages + Cloudflare content services, Vercel/Netlify/Render Web + Supabase, and Runway bundled path: supported
- Firebase and Appwrite content-services paths: supported in setup/docs matrix, with hosted runtime adapter work still partial
- one-click hosted migration from WordPress: not claimed

Deployment model:

- `App Host` means where the Astro web app runs
- `Content Services` means where Astropress stores content, media, auth, sessions, and the Astropress service API
- examples:
  - `cloudflare-pages` + `cloudflare`
  - `vercel` + `supabase`
  - `netlify` + `supabase`
  - `render-web` + `firebase`
  - `github-pages` + `none`
- Supabase, Firebase, Appwrite, and similar services are not described as app hosts

Product boundary:

- production source of truth is a database-backed content store
- git sync is for export, backup, review, and static-host deployment workflows
- Astropress now separates app-host selection from content-services selection instead of overloading both into one provider label
- editors should not need Git for normal publishing work

Current repository shape:

- `packages/astropress` — published npm package
- `crates/astropress-cli` — Rust CLI crate
- `examples/github-pages` — static example site plus docs/admin explainer for GitHub Pages
- `SPEC.md` — production architecture contract
- `features/` — BDD source of truth

CLI delivery model:

- the CLI is authored as a Cargo crate
- the npm package exposes an `astropress` wrapper command
- the wrapper can use `ASTROPRESS_CLI_BIN` for a prebuilt binary or fall back to `cargo run` in-repo

Development:

- `bun install`
- `bun run test`
- `bun run bdd:test`
- `bun run test:coverage`
- `bun run test:cli`
- `bun run test:example`
- `bun run test:static-site`
- `bun run test:admin-harness`
- `bun run test:accessibility`
- `bun run test:accessibility:browser`
- `bun run test:accessibility:admin-harness`
- `bun run audit:security`

Specs:

- org-level: `SPEC.md`
- package: `packages/astropress/SPEC.md`
- CLI: `crates/astropress-cli/SPEC.md`
- example/docs: `examples/github-pages/SPEC.md`

Planning docs:

- complete local + future staging setup: `SETUP.md`
- org layout and split strategy: `docs/ORG_LAYOUT.md`
- local split map: `docs/LOCAL_SPLIT.md`
- consumer migration map: `docs/CONSUMER_MIGRATION.md`
- GitHub bootstrap status: `docs/GITHUB_BOOTSTRAP.md`
- quality roadmap and enforced gates: `docs/QUALITY_ROADMAP.md`
- operations runbook: `docs/OPERATIONS.md`
- security policy: `SECURITY.md`

Host integration helpers:

- `astropress/integration` re-exports the current Vite, Vitest, and host-runtime helper surface from one place
- `astropress/hosted-platform-adapter` exposes the package-owned assembler for hosted providers built from explicit store modules
- `astropress/adapters/sqlite`, `astropress/adapters/local`, `astropress/adapters/hosted`, `astropress/adapters/project`, `astropress/adapters/cloudflare`, `astropress/adapters/supabase`, and `astropress/adapters/runway` expose first-party provider adapter factories
- `astropress/provider-choice` exposes the package-owned provider recommendation helper used by scaffolding, docs, and future setup flows
- `astropress/app-host-targets`, `astropress/data-service-targets`, and `astropress/deployment-matrix` expose the current hosting matrix metadata
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
- `astropress/project-env` now resolves `ASTROPRESS_APP_HOST`, `ASTROPRESS_CONTENT_SERVICES`, and `ASTROPRESS_SERVICE_ORIGIN` in addition to legacy provider vars for compatibility
- both selector surfaces now accept an explicit `env` map, so startup code can resolve providers from package-owned env contracts without mutating `process.env`
- `astropress/adapters/supabase-sqlite` and `astropress/adapters/runway-sqlite` wrap that packaged SQLite runtime behind provider-specific capabilities for local development
- Supabase and Runway hosted adapters can now load and validate their provider env config inside Astropress before building hosted-store adapters
- `astropress/sqlite-bootstrap` exposes the packaged schema/bootstrap toolkit for local admin databases
- `astropress/sqlite-admin-runtime` exposes the packaged Node SQLite admin runtime
- those Node-only SQLite entry points stay off the root `astropress` API and are stubbed out of Cloudflare builds

Current CLI workflow behavior:

- `astropress new` scaffolds the example site and writes local SQLite defaults in `.env` and `.data/`
- `astropress new --app-host <host> --content-services <services>` separates where the Astro app runs from where Astropress stores content, media, auth state, and the service API
- `astropress dev --app-host <host> --content-services <services>` keeps that split visible during local startup
- `--provider` and the old `ASTROPRESS_*PROVIDER` / `ASTROPRESS_DEPLOY_TARGET` envs are deprecated compatibility shims; new scaffolds only emit the canonical `App Host` and `Content Services` contract
- `astropress backup` and `astropress restore` wrap the packaged snapshot workflow behind operator-friendly commands
- `astropress doctor` resolves the package-owned runtime plan and warns about missing local secrets, missing `.data` paths, missing `ASTROPRESS_SERVICE_ORIGIN`, and legacy projects that still rely on implicit provider inference
- `astropress services bootstrap` writes a package-owned manifest for the selected content-services layer so operators can confirm the expected service origin and required keys before deployment
- `astropress services verify` checks that the selected content-services layer has the required keys and a known service origin
- `astropress import wordpress` now stages a production-style artifact set including content, media, comments, users, taxonomies, redirects, remediation candidates, and resumable download state
- `astropress import wordpress --apply-local` can apply the staged import into the supported local SQLite runtime while still keeping the artifact set and review report
- `astropress import wordpress --download-media --artifact-dir <dir>` downloads attachment assets into the staged artifact directory and supports re-entry with `--resume`
- `astropress sync export`, `astropress sync import`, and GitHub Pages deploy now call the packaged Astropress workflow modules rather than duplicating those workflows in Rust
- `astropress deploy --app-host <host>` now targets the app-host layer explicitly
- first-party deploy targets now exist for GitHub Pages, Cloudflare Pages, Vercel, Netlify, Render, GitLab Pages, Firebase Hosting, and custom handoff flows; locally they prepare deployment artifacts under `.astropress/deployments/`
- the package-owned recommendation system defaults to a clear host-plus-services pair instead of pretending one provider label covers both concerns

Why there are duplicated `src/*.ts` and `src/*.js` files:

- the TypeScript files are the source of truth for typed development inside the repo
- the matching JavaScript files exist for runtime entry points that must load directly from `node_modules` in Bun/Node without a TypeScript build step
- this is deliberate package-boundary plumbing, not two independent implementations
- the JS entry points keep tarball consumers and config-time imports working while Astropress is still distributed as source plus selected runtime JS shims

Why `local-runtime-modules` exists:

- Astropress is intended to be reusable, but the actual admin store, auth backend, content registry, and local asset readers are host-app concerns until the full provider adapter layer is finished.
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
