# @astropress-diy/astropress

A web application framework for editorial, informational, and campaign sites built on [Astro](https://astro.build). Ships a headless admin panel, a REST API, and a SQLite runtime. Host applications compose these into their own Astro sites — Astropress is not a hosted service or a SaaS.

```bash
cargo install astropress-cli
astropress new my-site
cd my-site && astropress dev
```

Open `http://localhost:4321/ap-admin` and log in.

## When to use it

- You need a real content admin without building one yourself
- You want a Git-friendly static export path (GitHub Pages, Netlify, Vercel)
- Your editors should not need Git for everyday publishing
- You want a privacy-first, self-hosted stack with no third-party analytics by default
- You need a CMS that runs at the edge (Cloudflare Pages + D1)

## Deployment targets

| App host | Content services | Notes |
|---|---|---|
| `github-pages` | `none` | Static output; SQLite at build time |
| `cloudflare-pages` | `cloudflare` | D1 + R2; full edge deployment |
| `vercel` or `netlify` | `supabase` | Postgres + Storage |
| `render-web` | `appwrite` | Self-hosted backend services |

## Adapter status

| Adapter | Status |
|---|---|
| SQLite (local) | Full — reference implementation |
| Cloudflare D1 + R2 | Full |
| Supabase (Postgres + Storage) | Full |
| Appwrite | Full |
| Neon | Full |
| Turso | Full |

## Security

- Argon2id password hashing
- KMAC256 API token hardening
- ML-DSA-65 webhook signatures
- CSRF protection on all admin form actions
- Content Security Policy headers
- Rate limiting on auth endpoints

## CLI

The Astropress CLI (`astropress new`, `astropress dev`, `astropress doctor`, `astropress import`) is a separate Rust binary. Install from crates.io:

```bash
cargo install astropress-cli
```

Or download a pre-built binary from the [Releases](https://github.com/astropress/astropress/releases) page (Linux x64/arm64, macOS x64/arm64, Windows x64).

## AI agent integration

The [`@astropress-diy/mcp`](https://www.npmjs.com/package/@astropress-diy/mcp) package exposes Astropress content operations as MCP tools so AI agents (Claude, Cursor, etc.) can read and write content directly.

## Multi-site

The [`@astropress-diy/nexus`](https://www.npmjs.com/package/@astropress-diy/nexus) package provides a single control plane over multiple Astropress sites — aggregate content, trigger redeployments, and monitor health from one place.

## Documentation

- [Quick start](https://astropress.diy/docs/guides/quick-start)
- [Operations guide](https://astropress.diy/docs/guides/operations)
- [CLI reference](https://astropress.diy/docs/reference/cli)
- [API reference](https://astropress.diy/docs/reference/api)
- [Web components](https://astropress.diy/docs/reference/web-components)
- [Security policy](https://github.com/astropress/astropress/blob/main/SECURITY.md)

## License

MIT — see [LICENSE](./LICENSE).
