# Astropress Package Specification

## Scope

This spec covers the published npm package currently located at `packages/astropress`.

If Astropress later splits into multiple repositories, this file should move with the package repo.

## Responsibilities

The package is responsible for:

- the reusable web-app runtime surface for relatively simple websites
- provider-neutral contracts
- host-facing integration helpers
- admin components and shared models
- package-owned admin UI defaults with host override hooks for branding, labels, favicon, logo, navigation naming, and optional custom stylesheet loading
- runtime utilities used by consuming Astro sites
- packaged local runtime assets such as the SQLite schema/bootstrap/runtime path
- package-owned provider recommendation logic for non-technical setup flows
- package-owned project launch planning so CLI and consumers share one runtime/bootstrap decision path

## Package Contract

The package must expose stable import paths for:

- the main public API from `astropress`
- host integration helpers from `astropress/integration`
- hosted provider assembly from `astropress/hosted-platform-adapter`
- first-party provider adapters from `astropress/adapters/*`
- deploy/import/sync workflows from `astropress/deploy/*`, `astropress/import/*`, and `astropress/sync/*`
- host-runtime seam typing from `astropress/host-runtime-modules`
- typed local seam contracts from `astropress/local-runtime-modules`
- provider/runtime stubs needed by consuming apps
- current host-facing runtime modules during extraction

The package should reduce host-specific glue over time by replacing temporary seams with real provider adapters.

## Current Runtime State

- `astropress/adapters/sqlite` is a first-party SQLite-backed adapter, not a placeholder capability shim
- `astropress/hosted-platform-adapter` is the package-owned assembly surface for hosted provider runtimes built from explicit stores
- `astropress/adapters/local` chooses the local SQLite-backed provider runtime for sqlite, Supabase, or Runway
- `astropress/adapters/hosted` chooses the hosted provider runtime for Supabase or Runway
- `astropress/adapters/project` chooses local or hosted runtime mode from the project env contract
- `astropress/project-launch` converts the project env and runtime mode into one launch/bootstrap plan
- `astropress/import/wordpress` owns a staged WordPress import pipeline with typed inspection, plan generation, artifact output, remediation reporting, and resumable media download state
- provider selectors must support explicit env maps as well as ambient process env
- `astropress/adapters/supabase-sqlite` and `astropress/adapters/runway-sqlite` provide Node-only provider-local runtimes backed by the packaged SQLite adapter
- Supabase and Runway hosted config loading and runtime guards are package-owned, not host-app glue
- `astropress/sqlite-bootstrap` owns the packaged schema/bootstrap path for local admin databases
- `astropress/sqlite-admin-runtime` owns the packaged Node SQLite admin runtime
- Node-only runtime entry points stay on explicit subpaths and must not leak through the root package API into Cloudflare builds

## Design Constraints

- no provider-specific editorial behavior in shared admin templates
- no git-first authoring requirement
- support non-technical editors
- target individuals and small organizations running relatively simple sites
- do not drift into a generic site-builder product model
- support GitHub Pages, Cloudflare, Supabase, and Runway through stable contracts
- keep published entry points stable once consumers adopt them

## Extraction Goal

Consuming apps should eventually depend only on published Astropress package entry points, not repo-relative source paths.
