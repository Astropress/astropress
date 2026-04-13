//! Starlight (Astro, MIT) — WCAG AA, keyboard nav, Pagefind search.

pub(super) fn stubs() -> Vec<(&'static str, &'static str)> {
    vec![
        ("docs/package.json",               PACKAGE_JSON),
        ("docs/astro.config.mjs",           ASTRO_CONFIG),
        ("docs/src/content/docs/index.mdx", INDEX_MDX),
        ("docs/README.md",                  README),
    ]
}

const PACKAGE_JSON: &str = r#"{
  "name": "docs",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/starlight": "^0.29.0",
    "astro": "^5.0.0",
    "sharp": "^0.33.0"
  }
}
"#;

const ASTRO_CONFIG: &str = r#"// Starlight config — MIT, community-owned (Astro team).
// Accessibility: WCAG AA colour contrast, skip-to-content, keyboard navigation,
// and `prefers-reduced-motion` support ship by default.
// Docs: https://starlight.astro.build/guides/accessibility/
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Documentation',
      sidebar: [
        {
          label: 'Start here',
          items: [{ label: 'Introduction', slug: 'index' }],
        },
      ],
    }),
  ],
});
"#;

const INDEX_MDX: &str = r#"---
title: Documentation
description: Astropress project documentation.
---

Welcome. Replace this page with your own content.

## Why Starlight?

- **MIT-licensed**, community-maintained by the Astro team.
- **WCAG AA** colour contrast, skip-to-content link, keyboard navigation,
  and `prefers-reduced-motion` support out of the box.
- **Built-in search** (Pagefind) runs at build time — no server, no tracking.

Add more pages under `src/content/docs/` and register them in `astro.config.mjs`.
"#;

const README: &str = r#"# Docs site (Starlight)

Lightweight, accessible documentation site. MIT-licensed, community-owned.

## Local development

```sh
cd docs
npm install      # or `bun install`
npm run dev      # http://localhost:4321
```

## Build static output

```sh
npm run build    # emits `dist/`
```

Deploy `dist/` to any static host (GitHub Pages, Cloudflare Pages, Netlify,
GitLab Pages). See https://starlight.astro.build/guides/deploying/.
"#;
