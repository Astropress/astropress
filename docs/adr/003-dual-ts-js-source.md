# ADR-003: Paired .ts/.js Source Files

**Date:** 2024-10-01
**Status:** Accepted (updated 2026-04-12 — `.js` files are now generated output)

## Context

The `packages/astropress/src/` directory contains both `.ts` and `.js` files for the same modules (e.g., `config.ts` and `config.js`). This looks unusual — most TypeScript projects either compile TS to JS or use a bundler.

The reason is that `astropress` is distributed with pre-built `.js` companions so consumers can import from the package at *config time* (before Vite/Astro's TypeScript resolution is active). Specifically:

- `astro.config.mjs` runs in Node before the TypeScript build pipeline starts
- `bun` consumers can import TypeScript directly
- Cloudflare Workers require a separate compile step

Options considered:
1. **Compile TS to JS** — run `tsc` or `bun build` as a pre-publish step. This means consumers always get compiled JS. But it requires a build pipeline and means the source in the repo differs from the distributed code.
2. **TypeScript-only** — ship only `.ts` files and require all consumers to use a runtime that supports TS. This breaks `node:` consumers and Astro config files.
3. **Paired .ts/.js** — keep `.ts` as the TypeScript source of truth and generate `.js` companions that match the `.ts` exports exactly. The `.js` files serve config-time and runtime consumers; the `.ts` files serve typed development.

## Decision

Ship **paired `.ts` and `.js` files** for every source file in `src/`. The `.js` files are **generated output** — produced by `bun run sync:js` (`tsc -p tsconfig.build.json --noCheck` followed by an import-path rewriter). They are gitignored (`src/**/*.js`, `/index.js`) and never committed. Edit only the `.ts` source files.

An `audit:sync` CI script verifies that every exported name in `.ts` exists in the generated `.js` and vice versa. Pre-commit hooks run this check automatically.

```
src/config.ts    ← TypeScript source of truth (edit this)
src/config.js    ← generated JS companion (gitignored; regenerate with bun run sync:js)
```

## Consequences

**Positive:**
- Works in all consumer environments: Bun, Node, Cloudflare Workers, Astro config
- Contributors only edit `.ts` — no dual-maintenance discipline required
- TypeScript types are available via the `.ts` files during development
- `audit:sync` in CI catches export divergence between `.ts` and generated `.js`

**Negative:**
- The `bun run sync:js` step must be run before publishing to npm
- The sync requirement is non-obvious to contributors; it's documented in `CONTRIBUTING.md` and enforced by CI and pre-commit hooks
