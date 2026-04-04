# Astropress

Astropress is a provider-neutral CMS toolkit for low-carbon publishing, WordPress migration, and new editorial Astro sites.

Current repository shape:

- `packages/astropress` — published npm package
- `crates/astropress-cli` — Rust CLI crate
- `examples/github-pages` — static example site plus docs/admin explainer for GitHub Pages
- `SPEC.md` — production architecture contract
- `features/` — BDD source of truth

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
- consumer migration map: `docs/CONSUMER_MIGRATION.md`
- GitHub bootstrap status: `docs/GITHUB_BOOTSTRAP.md`

Host integration helpers:

- `astropress/integration` re-exports the current Vite, Vitest, and host-runtime helper surface from one place
- `astropress/vite-integration` composes the standard Vite plugin and alias rules into one helper
- `astropress/vite-runtime-alias` exposes reusable Vite alias/plugin helpers for `local-runtime-modules`
- `astropress/vitest-runtime-alias` exposes reusable Vitest plugin helpers for external-package test runs
- `astropress/local-runtime-modules` exposes the typed seam contract for host implementations
- `astropress/cloudflare-workers-stub` and `astropress/cloudflare-local-runtime-stubs` are exported as stable package entry points
- current host-facing runtime modules are also exported as stable subpaths so consuming apps can stop using repo-relative `src` paths during extraction

Why `local-runtime-modules` exists:

- Astropress is intended to be reusable, but the actual admin store, auth backend, CMS registry, and local asset readers are host-app concerns until the full provider adapter layer is finished.
- `local-runtime-modules` is the temporary boundary that lets the reusable package dynamically load those host-owned implementations without hard-coding Fleet-specific files into the package.
- In development and test, the host app aliases `./local-runtime-modules` to its own implementation file.
- In Cloudflare-style builds, the host can instead point that import at `astropress/cloudflare-local-runtime-stubs` so unsupported local fallbacks fail explicitly.
- The host-side implementation shape is now documented and typed through `astropress/host-runtime-modules`.
