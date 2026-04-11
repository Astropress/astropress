# ADR-003: Paired .ts/.js Source Files

**Date:** 2024-10-01
**Status:** Accepted

## Context

The `packages/astropress/src/` directory contains both `.ts` and `.js` files for the same modules (e.g., `config.ts` and `config.js`). This looks unusual — most TypeScript projects either compile TS to JS or use a bundler.

The reason is that `astropress` is distributed as *source* (no separate build step), but some consumers need to import from the package at *config time* (before Vite/Astro's TypeScript resolution is active). Specifically:

- `astro.config.mjs` runs in Node before the TypeScript build pipeline starts
- `bun` consumers can import TypeScript directly
- Cloudflare Workers require a separate compile step

Options considered:
1. **Compile TS to JS** — run `tsc` or `bun build` as a pre-publish step. This means consumers always get compiled JS. But it requires a build pipeline and means the source in the repo differs from the distributed code.
2. **TypeScript-only** — ship only `.ts` files and require all consumers to use a runtime that supports TS. This breaks `node:` consumers and Astro config files.
3. **Paired .ts/.js** — keep `.ts` as the TypeScript source of truth and maintain hand-authored `.js` companions that match the `.ts` exports exactly. The `.js` files serve config-time and runtime consumers; the `.ts` files serve typed development.

## Decision

Ship **paired `.ts` and `.js` files** for every source file in `src/`. The `.js` files are hand-authored companions, not compiled output. An `audit:sync` CI script (`scripts/check-js-sync.ts`) verifies that every exported name in `.ts` exists in `.js` and vice versa.

```
src/config.ts    ← TypeScript source of truth (types, IDE support)
src/config.js    ← hand-authored JS companion (same exports, no types)
```

## Consequences

**Positive:**
- Works in all consumer environments: Bun, Node, Cloudflare Workers, Astro config
- No build step required — consumers `bun add astropress` and it works immediately
- TypeScript types are available via the `.ts` files during development
- `audit:sync` in CI catches divergence between `.ts` and `.js` exports

**Negative:**
- Every new export must be added to both `.ts` and `.js` files — discipline required
- The `.js` files are not generated — human error can introduce divergence despite the lint guard
- The sync requirement is non-obvious to contributors; it's documented in `CLAUDE.md` and enforced by CI
- Future: a `bun build` step would eliminate the `.js` files and the sync requirement
