# Astropress

A web application framework for editorial, informational, and campaign sites. Ships
a headless admin panel, a REST API, and a SQLite runtime. Host applications compose
these into their own Astro sites — Astropress is not a hosted service.

## When to use it

- You need a real content admin without writing one yourself
- You want a Git-friendly static export path (GitHub Pages, Netlify, Vercel)
- Your editors should not need Git for everyday publishing
- You want a privacy-first, self-hosted stack (no third-party analytics forced on you)

## Get started

```bash
bun create astropress my-site
cd my-site && bun dev
```

Open `http://localhost:4321/ap-admin` and log in.

Full walkthrough: [docs/QUICK_START.md](./docs/QUICK_START.md)

## Documentation

| Doc | What it covers |
|-----|----------------|
| [QUICK_START.md](./docs/QUICK_START.md) | Scaffold, env setup, 5-minute getting started |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Provider seam, two-table schema, security model |
| [OPERATIONS.md](./docs/OPERATIONS.md) | Import, backup, migrations, secret rotation, incident runbook |
| [ANALYTICS.md](./docs/ANALYTICS.md) | Analytics providers, consent banner, custom snippets |
| [WEB_COMPONENTS.md](./docs/WEB_COMPONENTS.md) | Built-in elements, extending, screen reader guide |
| [MULTILINGUAL.md](./docs/MULTILINGUAL.md) | Locale config, hreflang, admin UI labels |
| [COMPLIANCE.md](./docs/COMPLIANCE.md) | GDPR data inventory, right of erasure SQL, audit log |
| [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | CSS tokens, contrast ratios, adding admin pages |
| [BROWSER_SUPPORT.md](./docs/BROWSER_SUPPORT.md) | Minimum versions, key API requirements |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local setup, test commands, PR checklist |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting, SLA |

## Deployment model

`App Host` is where the Astro web app runs. `Content Services` is where Astropress
stores content, media, auth, and sessions. These are independent selections.

| App Host | Content Services | Notes |
|----------|-----------------|-------|
| `github-pages` | `none` | Static output; SQLite at build time |
| `cloudflare-pages` | `cloudflare` | D1 + R2; full edge deployment |
| `vercel` or `netlify` | `supabase` | Postgres + Storage |
| `render-web` | `appwrite` | Full backend services + Astro on Render |
| `runway` | `runway` | Bundled path |

## Adapter status

| Adapter | Status |
|---------|--------|
| SQLite (local) | Full — reference implementation |
| Cloudflare D1 + R2 | Full |
| Supabase (Postgres + Storage) | Full |
| Runway | Full |
| Appwrite | Full |

## Development

```bash
bun install
bun run test              # arch lint + BDD + Vitest
bun run test:coverage     # with 97% coverage thresholds
bun run test:acceptance   # Playwright + axe
bun run test:cli          # Rust CLI (cargo test)
bun run audit:arch        # architecture boundary checks
bun run audit:sync        # .ts/.js export parity
```

## Repository layout

```
packages/astropress/      # Published npm package
  src/                    # TypeScript source (paired .ts/.js)
  pages/ap-admin/         # Admin UI pages
  pages/ap-api/v1/        # REST API endpoints
  web-components/         # Vanilla Web Components

crates/astropress-cli/    # Rust CLI
  src/commands/           # One file per command

packages/astropress-mcp/  # MCP server (7 tools for AI agents)
features/                 # Gherkin BDD scenarios
```

## License

MIT
