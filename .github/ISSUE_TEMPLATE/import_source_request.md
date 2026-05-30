---
name: Import source request (migrate from a platform)
about: Request a new migration source — CMS, site builder, or subscriber-list export
title: "[Import] "
labels: import, enhancement
assignees: ""
---

> **Not a migration source?** For new *hosting providers or data services* (Cloudflare, Turso, Neon, S3…) use the [adapter request](?template=adapter_support.md). For new *external tools* (analytics, email, donations) use the [integration request](?template=integration_request.md). For new *locales* use the [language request](?template=language_request.md).

## Source platform details

| Field | Value |
|-------|-------|
| Source platform name | <!-- e.g. Drupal, Joomla, Squarespace, Ghost, Substack --> |
| Source kind | <!-- CMS / site builder / subscriber list / static-site generator --> |
| Export format the source produces | <!-- XML / JSON / CSV / ZIP / live HTTP crawl / DB dump --> |
| Public docs for the export | <!-- link to the source's export/format docs --> |

## What does the source let an operator export?

Tick all that apply:

- [ ] **Pages and posts** (HTML or Markdown body, title, slug, status)
- [ ] **Media files** (images, attachments, with original URLs)
- [ ] **Taxonomies** (categories, tags)
- [ ] **Authors / users**
- [ ] **Comments**
- [ ] **Redirects** (legacy URLs → new paths)
- [ ] **Subscriber lists** (email + status, like the Mailchimp importer)
- [ ] **Other**: ___

## Why this source?

One paragraph: which users get unblocked by this importer? Linking a public site that already runs on the source platform helps maintainers gauge scope.

## Proposed stage-then-apply shape

Astropress importers stage migrations into a reviewable artifact before applying them locally (see `packages/astropress/src/import/` — the WordPress XML and Wix CSV importers are the precedents). Sketch which stage helpers and apply helpers this source would need:

- Fetch / parse: ___
- Stage artifact (`*-import-staged.json`): ___
- Apply helper (writes into the local content store): ___
- Media download path (must go through `downloadMediaToFile()` from `packages/astropress/src/import/download-media.ts` for SSRF + content-type + size enforcement)

## Can you help implement it?

- [ ] Yes — I can submit a PR including a recording fixture of the source's export.
- [ ] Partial — I can supply a real export from a site I own as a fixture.
- [ ] No — I am requesting only.

## Pointers

- `packages/astropress/src/import/wordpress-xml.ts` — XML-export precedent
- `packages/astropress/src/import/wix-csv.ts` — CSV / multi-file-export precedent
- `packages/astropress/src/import/download-media.ts` — required for any HTTP media fetch
- [CONTRIBUTING.md → Requesting and contributing providers](../../CONTRIBUTING.md#requesting-and-contributing-providers)
