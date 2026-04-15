<div align="center">

# Astropress

**Your website launchpad.**

A low-carbon, free, open-source site builder and web framework for static sites, dynamic sites, and web apps —  
with a built-in admin panel, AI-ready scaffolding, and zero vendor lock-in.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/astropress?color=orange&label=npm)](https://www.npmjs.com/package/astropress)
[![CI](https://img.shields.io/github/actions/workflow/status/astropress/astropress/ci.yml?label=CI&logo=github)](https://github.com/astropress/astropress/actions)
[![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen)](#)
[![Node ≥ 24.8](https://img.shields.io/badge/node-%E2%89%A524.8-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![Bun 1.3](https://img.shields.io/badge/bun-1.3-f472b6?logo=bun&logoColor=white)](https://bun.sh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](./CONTRIBUTING.md)

</div>

---

## What is Astropress?

Astropress covers the common pieces of a real website — a clean editing dashboard, pages and blog posts, media uploads, contact forms, redirects, multilingual support, and more — without forced subscriptions, vendor lock-in, or needing a large engineering team to assemble the basics.

Own your content. Choose where it lives. Export at any time. Launch your initiative!

It supports both **static sites** (with free hosting on, e.g, GitHub Pages or Netlify) and **dynamic sites** (on Cloudflare, Render, or your own server). Moving between them is designed to avoid rewriting your content model or admin workflows.

Importing content from Wordpress or Wix, or even subscription lists from Mailchimp is easy. Add an issue if there are other platforms you want to escape the orbit of or hosting providers that can support ordinary people who just want to get to work on their dreams without becoming full-stack web developers.

**Designed to work with AI.** Ask Claude, Codex, Cursor, or any AI coding assistant to scaffold your site, add features, or customise the design. Astropress ships an [MCP server](./packages/astropress-mcp/) and a machine-readable [`llms.txt`](./llms.txt) so AI tools understand the codebase out of the box.

---

## What you get

| Feature | What it means for you |
|---|---|
| **Admin dashboard** | Write and publish content from a clean browser interface — no coding required |
| **Pages & blog** | Create any number of pages and posts, with drafts, scheduling, and revision history |
| **Media library** | Upload images and files; automatic thumbnails and srcsets |
| **SEO tools** | Page titles, descriptions, Open Graph, schema.org structured data |
| **Comments** | Moderated comment threads on any post or page |
| **Redirects** | Manage URL changes without breaking links |
| **User accounts** | Invite editors and authors with role-based access |
| **Multilingual** | Publish in multiple languages from the same admin |
| **Import from WordPress or Wix** | Stage your existing content into reviewable import artifacts before applying it locally |
| **Privacy-first** | No forced third-party analytics. No opt-out telemetry. Your data stays yours |
| **Accessibility** | WCAG 2.2 AA compliant admin UI, tested with axe and screen readers |
| **Open-Source Plugins** | Whether building a course, hosting events, or setting up shop: just add a new service |
| **Reasonably Secure** | Argon2id password hashing, KMAC256 token hardening, ML-DSA-65 webhook signatures, and security headers by default |
---

## Supported categories and tools

Use `astropress list tools` and `astropress list providers` for the CLI view. This is the current high-level support surface.

| Category | Supported tools | What affordance you get |
|---|---|---|
| **App hosts** | GitHub Pages, Cloudflare Pages, Vercel, Netlify, Render Static, Render Web, GitLab Pages, Fly.io, Coolify, DigitalOcean App Platform, Railway | Static deploys, server-backed deploys, or self-hosted/container deploy paths generated into `DEPLOY.md` and scaffold CI files |
| **Content/data services** | Built-in SQLite, Cloudflare D1 + R2, Supabase, Neon, Nhost, PocketBase, Appwrite, Turso, custom adapter | Keep Astropress content local, move it to a hosted service, or wire in a custom runtime adapter without changing the admin surface |
| **Import sources** | WordPress XML, Wix export/crawl | Stage migrations into reviewable artifacts before applying them locally |
| **Docs sites** | Starlight, VitePress, mdBook | Generate a docs area alongside the site with a matching scaffold and docs-specific build scripts |
| **Analytics** | Umami, Plausible, Matomo, PostHog, custom | Add privacy-first analytics, dashboards, and optional replay/heatmap support |
| **A/B testing and flags** | GrowthBook, Unleash, Flagsmith, custom | Feature flags, experiments, and release controls from the same project scaffold |
| **Forms and surveys** | Formbricks, Typebot | Surveys, testimonial capture, and embeddable workflows with generated env/config stubs |
| **Email and newsletters** | Listmonk, Resend, generic SMTP | Newsletter delivery, transactional email, and SMTP relay support |
| **Comments, forums, chat** | Giscus, Remark42, Flarum, Discourse, Tiledesk, Chatwoot | Community threads, forums, and live support surfaces that can be embedded or linked from the admin |
| **Search** | Pagefind, Meilisearch, Typesense | Zero-server static search or self-hosted full-text search backends |
| **Scheduling and events** | Rallly, Cal.com, Hi.Events, Pretix | Polls, booking flows, event listings, and ticketing integrations |
| **Commerce, payments, donations** | Medusa, Vendure, HyperSwitch, Polar, GiveLively, Liberapay, PledgeCrypto | Storefronts, payment orchestration, and donor flows without locking the site into one vendor |
| **Identity and operations** | Authentik, Zitadel, Uptime Kuma, Twenty, BookStack | SSO, status pages, CRM, and internal knowledge-base extensions |
| **Media and publishing** | PeerTube, Castopod, Postiz, Mixpost | Self-hosted video, podcast publishing, and social publishing workflows |

## Deployment paths

These are the current host + data-service paths the codebase treats as the main tracks:

| Support level | Pairings |
|---|---|
| **Supported** | `github-pages + none`, `cloudflare-pages + cloudflare`, `vercel + supabase`, `netlify + supabase`, `render-web + supabase` |
| **Preview** | `github-pages + supabase`, `gitlab-pages + supabase`, `cloudflare-pages + supabase`, `vercel/netlify/render-web + appwrite`, `fly-io + none/supabase/appwrite/turso`, `coolify + none/supabase/turso`, `digitalocean + supabase/appwrite/turso`, `vercel/netlify/render-web/cloudflare-pages + turso`, `railway + none/supabase/appwrite/turso` |

For a free-first starting point, the cleanest paths are:
- `github-pages + none` for static publishing with local authoring
- `cloudflare-pages + cloudflare` for an edge-backed setup
- `vercel + supabase` or `netlify + supabase` for a server-backed setup on free tiers

## Get started

### Dev installer (macOS / Linux / Windows)

The bundled installer bootstraps the Astropress repo for local development. It expects a checked-out copy of this repository:

```bash
git clone https://github.com/astropress/astropress.git
cd astropress
bash astropress/tooling/scripts/install.sh
```

### On Windows

```powershell
# In PowerShell from the cloned repo
git clone https://github.com/astropress/astropress.git
cd astropress
pwsh tooling/scripts/install.ps1
```

Both installers provision Bun, Node.js `24.8+`, Rust, and Playwright, then run the local verification suite unless you pass `--skip-tests`.

### Then scaffold your site

```bash
astropress new my-site
cd my-site
astropress dev
```

Open **http://localhost:4321/ap-admin** and log in with the credentials shown in your `.env` file.

> **Full walkthrough →** [docs/guides/QUICK_START.md](./docs/guides/QUICK_START.md)

---

## Build with AI

Astropress is designed for AI-assisted development. Hand off the technical work to an AI coding assistant and focus on your content and design.

**With Claude Code, Cursor, or any MCP-enabled tool:**

```bash
# The MCP server gives AI agents direct access to Astropress tools
cd my-site
astropress mcp start
```

**With any AI chat tool (ChatGPT, Claude, Gemini):**

The [`llms.txt`](./llms.txt) file at the root of every Astropress project describes the full API surface in plain text. Paste it into any AI conversation to get accurate, project-aware suggestions.

Ask your AI assistant things like:
- *"Add a newsletter signup form to my site"*
- *"Create a custom page template for my portfolio"*
- *"Migrate my site from SQLite to Cloudflare D1"*
- *"Add a custom analytics dashboard to the admin panel"*

---

## Hosting options

Astropress runs on the platforms you already use. Pick any combination:

| Where your site runs | Where your content lives | Best for |
|---|---|---|
| **GitHub Pages** | Built into the repo | Free static sites, blogs |
| **Cloudflare Pages** | Cloudflare D1 + R2 | Fast global edge, free tier |
| **Vercel / Netlify** | Supabase | Developer-friendly deploys |
| **Render** | Appwrite | Full backend on one platform |
| **Fly.io / Railway** | Neon / Turso | Container hosting + serverless SQL |

---

## Documentation

| Guide | What it covers |
|---|---|
| [Quick Start](./docs/guides/QUICK_START.md) | Scaffold, environment setup, first 5 minutes |
| [Operations](./docs/guides/OPERATIONS.md) | Backups, WordPress import, migrations, disaster recovery |
| [Analytics](./docs/guides/ANALYTICS.md) | Privacy-respecting analytics providers, consent banner |
| [Multilingual](./docs/guides/MULTILINGUAL.md) | Multiple languages, locale config, admin UI labels |
| [Compliance](./docs/guides/COMPLIANCE.md) | GDPR data inventory, right-of-erasure SQL, audit log |
| [Web Components](./docs/reference/WEB_COMPONENTS.md) | Built-in UI elements, screen reader guide |
| [Design System](./docs/reference/DESIGN_SYSTEM.md) | CSS tokens, contrast ratios, adding admin pages |
| [API Reference](./docs/reference/API_REFERENCE.md) | REST API endpoints, authentication, scopes |
| [Compatibility](./docs/reference/COMPATIBILITY.md) | OS support tiers, verified commands, shell coverage |
| [Architecture](./docs/reference/ARCHITECTURE.md) | Provider seam, schema ERD, security model |
| [Contributing](./CONTRIBUTING.md) | Local setup, test commands, PR checklist |
| [Security](./SECURITY.md) | Vulnerability reporting, response SLA |

---

## Contributing

Astropress is built in the open. Contributions of all kinds are welcome — bug reports, documentation improvements, new features, and translations.

```bash
git clone https://github.com/astropress/astropress.git
cd astropress
bash tooling/scripts/install.sh --skip-tests
bun run test   # arch lint + BDD + 1500+ unit tests
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide, test commands, and PR checklist.

---

## License

[MIT](./LICENSE) © Astropress Contributors
