# Astropress Org Layout

## Recommended Near-Term GitHub Organization

Create a GitHub organization named `astropress`.

Start with these repositories:

- `astropress/astropress`
- `astropress/.github`

Use `astropress/astropress` as the main monorepo for:

- the published npm package
- the Rust CLI crate
- example apps
- specs, BDD features, and test strategy docs

Current mapping from the local repo:

- `packages/astropress` -> published npm package
- `crates/astropress-cli` -> Rust CLI crate
- `examples/github-pages` -> example site and docs surface
- `SPEC.md` -> org-level product and architecture contract
- `features/` -> BDD source of truth
- `docs/` -> supporting testing and architecture docs

## Why Start With One Monorepo

- The package API is still moving.
- The provider adapter layer is not finished.
- The CLI and package still share evolving contracts.
- Keeping code together reduces release and coordination overhead during extraction.

## Recommended Split-Out Strategy

Do not split immediately. Split only after the package exports, host integration seams, and provider contracts have stabilized.

### Phase 1

Keep everything in:

- `astropress/astropress`

Ship from that repo:

- npm package from `packages/astropress`
- CLI binaries from `crates/astropress-cli`
- docs/example deployment from `examples/github-pages`
- repo-scoped specs from each subtree

### Phase 2

If the interfaces stabilize and contribution volume grows, consider splitting into:

- `astropress/astropress-js`
- `astropress/astropress-cli`
- `astropress/example-sites`
- `astropress/docs`

Optional later split for provider adapters:

- `astropress/adapter-cloudflare`
- `astropress/adapter-supabase`
- `astropress/adapter-runway`

### Phase 3

Only split provider adapters into separate repos if they actually need:

- separate release cadence
- separate maintainers
- separate compliance or secrets handling
- significantly different test infrastructure

## What Not To Split Yet

Do not split these yet:

- the Rust CLI
- provider adapters
- docs
- examples

Reason:

- all of them still depend on evolving contracts in the package core

## Practical Publishing Model

From `astropress/astropress`:

- publish `astropress` to npm
- publish release binaries for `astropress-cli`
- deploy docs/example from CI

Consumers should depend on the published package name rather than local filesystem paths such as `../../../astropress/packages/astropress`.
