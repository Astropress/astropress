# Consumer Migration

This document tracks how host apps should migrate away from repo-relative Astropress imports during the extraction period.

## Goal

Consumers should import Astropress through published package entry points, not through local filesystem paths such as:

- `../../../astropress/packages/astropress/src/...`
- `../../../../astropress/packages/astropress/src/...`

## Stable Replacements

Replace deep imports with these stable package paths where possible.

### Core package

- `astropress`

### Integration helpers

- `astropress/integration`
- `astropress/vite-runtime-alias`
- `astropress/vitest-runtime-alias`
- `astropress/host-runtime-modules`
- `astropress/local-runtime-modules`

### Provider/runtime stubs

- `astropress/cloudflare-workers-stub`
- `astropress/cloudflare-local-runtime-stubs`

### Host-facing runtime modules

- `astropress/admin-dashboard`
- `astropress/admin-page-models`
- `astropress/runtime-page-store`
- `astropress/runtime-admin-actions`
- `astropress/runtime-admin-auth`
- `astropress/runtime-route-registry`
- `astropress/runtime-env`
- `astropress/runtime-media-storage`
- `astropress/media`
- `astropress/site-settings`
- `astropress/seeded-content-type`
- `astropress/transactional-email`
- `astropress/newsletter-adapter`
- `astropress/turnstile`

### Components

- `astropress/components/*`

### Local storage helpers

- `astropress/local-image-storage`
- `astropress/local-media-storage`

## Fleet Migration Map

The current Fleet host still has a few extraction-era deep imports.

Known replacements:

- `../../../astropress/packages/astropress/src/cloudflare-workers-stub.ts`
  -> `astropress/cloudflare-workers-stub`
- `../../../astropress/packages/astropress/src/cloudflare-local-runtime-stubs.ts`
  -> `astropress/cloudflare-local-runtime-stubs`
- `../../../../../astropress/packages/astropress/src/admin-page-models.ts`
  -> `astropress/admin-page-models`
- `../../../../../astropress/packages/astropress/src/admin-dashboard`
  -> `astropress/admin-dashboard`
- `../../../../../astropress/packages/astropress/src/runtime-page-store`
  -> `astropress/runtime-page-store`
- `../../../../../astropress/packages/astropress/src/runtime-admin-actions`
  -> `astropress/runtime-admin-actions`
- `../../../../../astropress/packages/astropress/src/runtime-admin-auth`
  -> `astropress/runtime-admin-auth`
- `../../../../../astropress/packages/astropress/src/runtime-route-registry`
  -> `astropress/runtime-route-registry`
- `../../../../../astropress/packages/astropress/src/runtime-env`
  -> `astropress/runtime-env`
- `../../../../../astropress/packages/astropress/src/runtime-media-storage.ts`
  -> `astropress/runtime-media-storage`
- `../../../../../astropress/packages/astropress/src/media`
  -> `astropress/media`
- `../../../../../astropress/packages/astropress/src/site-settings`
  -> `astropress/site-settings`
- `../../../../../astropress/packages/astropress/src/seeded-content-type`
  -> `astropress/seeded-content-type`
- `../../../../../astropress/packages/astropress/src/transactional-email`
  -> `astropress/transactional-email`
- `../../../../../astropress/packages/astropress/src/newsletter-adapter`
  -> `astropress/newsletter-adapter`
- `../../../../../astropress/packages/astropress/src/turnstile`
  -> `astropress/turnstile`

## Remaining Known Gap

`local-runtime-modules` is still a host-owned implementation seam.

That means host apps still need their own implementation file, for example:

- `src/astropress/local-runtime-modules.ts`

But hosts should use Astropress-provided typing and integration helpers rather than ad hoc aliases:

- `astropress/integration`
- `astropress/host-runtime-modules`
- `astropress/local-runtime-modules`

## End State

When Astropress provider adapters are complete, host apps should need:

- minimal or no direct runtime-module aliasing
- published package imports only
- no repo-relative references into Astropress source files
