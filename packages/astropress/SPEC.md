# Astropress Package Specification

## Scope

This spec covers the published npm package currently located at `packages/astropress`.

If Astropress later splits into multiple repositories, this file should move with the package repo.

## Responsibilities

The package is responsible for:

- the reusable CMS runtime surface
- provider-neutral contracts
- host-facing integration helpers
- admin components and shared models
- runtime utilities used by consuming Astro sites

## Package Contract

The package must expose stable import paths for:

- the main public API from `astropress`
- host integration helpers from `astropress/integration`
- first-party provider adapters from `astropress/adapters/*`
- deploy/import/sync workflows from `astropress/deploy/*`, `astropress/import/*`, and `astropress/sync/*`
- host-runtime seam typing from `astropress/host-runtime-modules`
- typed local seam contracts from `astropress/local-runtime-modules`
- provider/runtime stubs needed by consuming apps
- current host-facing runtime modules during extraction

The package should reduce host-specific glue over time by replacing temporary seams with real provider adapters.

## Design Constraints

- no provider-specific editorial behavior in shared admin templates
- no git-first authoring requirement
- support non-technical editors
- support GitHub Pages, Cloudflare, Supabase, and Runway through stable contracts
- keep published entry points stable once consumers adopt them

## Extraction Goal

Consuming apps should eventually depend only on published Astropress package entry points, not repo-relative source paths.
