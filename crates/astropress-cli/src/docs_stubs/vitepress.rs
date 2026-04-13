//! VitePress (Vue, MIT) — minimal, keyboard-friendly, local search.

pub(super) fn stubs() -> Vec<(&'static str, &'static str)> {
    vec![
        ("docs/package.json",          PACKAGE_JSON),
        ("docs/.vitepress/config.mjs", CONFIG),
        ("docs/index.md",              INDEX_MD),
        ("docs/README.md",             README),
    ]
}

const PACKAGE_JSON: &str = r#"{
  "name": "docs",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.5.0"
  }
}
"#;

const CONFIG: &str = r#"// VitePress config — MIT, community-owned (Vue team).
// Accessibility: semantic HTML, keyboard navigation, skip links, and
// light/dark themes with AA contrast ratios ship by default.
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Documentation',
  description: 'Astropress project documentation.',
  themeConfig: {
    search: { provider: 'local' },
    sidebar: [
      {
        text: 'Start here',
        items: [{ text: 'Introduction', link: '/' }],
      },
    ],
  },
});
"#;

const INDEX_MD: &str = r#"# Documentation

Welcome. Replace this page with your own content.

## Why VitePress?

- **MIT-licensed**, community-maintained by the Vue team.
- **Local-first** client-side search — no third-party script, no tracking.
- **Semantic HTML** with keyboard navigation and accessible dark/light themes.

Add more pages as markdown files under `docs/` and register them in
`.vitepress/config.mjs`.
"#;

const README: &str = r#"# Docs site (VitePress)

Lightweight, accessible documentation site. MIT-licensed, community-owned.

## Local development

```sh
cd docs
npm install          # or `bun install`
npm run docs:dev     # http://localhost:5173
```

## Build static output

```sh
npm run docs:build   # emits `.vitepress/dist/`
```

Deploy `.vitepress/dist/` to any static host. See
https://vitepress.dev/guide/deploy.
"#;
