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

Host integration helpers:

- `astropress/vite-runtime-alias` exposes reusable Vite alias/plugin helpers for `local-runtime-modules`
- `astropress/vitest-runtime-alias` exposes reusable Vitest plugin helpers for external-package test runs
- `astropress/cloudflare-workers-stub` and `astropress/cloudflare-local-runtime-stubs` are exported as stable package entry points
