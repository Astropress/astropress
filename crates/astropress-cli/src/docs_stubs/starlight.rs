//! Starlight (Astro, MIT) — inline integration into the existing Astro project.
//!
//! Unlike VitePress and mdBook, Starlight is itself an Astro integration and
//! therefore belongs *inside* the user's existing `astro.config.mjs` rather
//! than in a separate `docs/` subproject.  The CLI cannot safely rewrite
//! `astro.config.mjs` (the user may have customised it), so instead we:
//!
//! 1. Create `src/content/docs/index.mdx` — the first docs page.
//! 2. Create `DOCS.md` — a setup guide with the exact `bun add` command and
//!    the `astro.config.mjs` diff to copy-paste.

pub(super) fn stubs() -> Vec<(&'static str, &'static str)> {
    vec![
        ("src/content/docs/index.mdx", INDEX_MDX),
        ("DOCS.md",                    DOCS_MD),
    ]
}

const INDEX_MDX: &str = r#"---
title: Documentation
description: Astropress project documentation.
---

Welcome. Replace this page with your own content.

## Getting started

Add more pages as `.mdx` or `.md` files under `src/content/docs/` and
register them in the `sidebar` inside `astro.config.mjs`.

## Why Starlight?

- **MIT-licensed**, community-maintained by the Astro team.
- **WCAG AA** colour contrast, skip-to-content link, keyboard navigation,
  and `prefers-reduced-motion` support out of the box.
- **Built-in search** (Pagefind) runs at build time — no server, no tracking.
- **Zero extra deploy** — docs live at `/docs` on your existing Astro site.
"#;

const DOCS_MD: &str = r#"# Docs site setup (Starlight)

Starlight is an Astro integration — it lives inside your existing project
rather than as a separate subproject. Two manual steps are required because
the CLI cannot safely rewrite `astro.config.mjs`.

## Step 1 — Install Starlight

```sh
bun add @astrojs/starlight sharp
```

(`sharp` is needed for Starlight's built-in image optimisation.)

## Step 2 — Add Starlight to astro.config.mjs

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
// ... your other imports

export default defineConfig({
  integrations: [
    // ... your other integrations
    starlight({
      title: 'Documentation',
      // Accessibility: WCAG AA contrast, skip-to-content, keyboard nav,
      // and prefers-reduced-motion support ship by default.
      // https://starlight.astro.build/guides/accessibility/
      sidebar: [
        {
          label: 'Start here',
          items: [{ label: 'Introduction', slug: 'index' }],
        },
      ],
    }),
  ],
});
```

Docs content lives in `src/content/docs/`. The first page was created at
`src/content/docs/index.mdx` by `astropress add --docs starlight`.

## Step 3 — Preview locally

```sh
bun run dev     # docs available at http://localhost:4321/docs
```

## Deploy

Docs deploy as part of your normal `astro build` — no separate pipeline.
The output lands in `dist/docs/` alongside your main site.

## Further reading

- Starlight docs: https://starlight.astro.build
- Accessibility guide: https://starlight.astro.build/guides/accessibility/
- Deploying: https://starlight.astro.build/guides/deploying/
"#;
