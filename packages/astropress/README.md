# astropress

A web application framework for editorial, informational, and campaign sites. Ships a headless
admin panel, a REST API, and a SQLite runtime. Host applications compose these into their own
Astro sites — Astropress is not a hosted service.

```bash
bun create astropress my-site
cd my-site && bun dev
```

Open `http://localhost:4321/ap-admin` and log in.

## When to use it

- You need a real content admin without writing one yourself
- You want a Git-friendly static export path (GitHub Pages, Netlify, Vercel)
- Your editors should not need Git for everyday publishing
- You want a privacy-first, self-hosted stack (no third-party analytics by default)

## Deployment model

| App Host | Content Services | Notes |
|----------|-----------------|-------|
| `github-pages` | `none` | Static output; SQLite at build time |
| `cloudflare-pages` | `cloudflare` | D1 + R2; full edge deployment |
| `vercel` or `netlify` | `supabase` | Postgres + Storage |
| `render-web` | `appwrite` | Full backend services |
| `runway` | `runway` | Bundled path |

## Adapter status

| Adapter | Status |
|---------|--------|
| SQLite (local) | Full — reference implementation |
| Cloudflare D1 + R2 | Full |
| Supabase (Postgres + Storage) | Full |
| Runway | Full |
| Appwrite | Full |

## CLI

The Astropress CLI (`astropress new`, `astropress doctor`, `astropress import`) is a separate
Rust binary — install it independently:

```bash
cargo install astropress-cli
```

Pre-built binaries are available on the
[Releases](https://github.com/astropress/astropress/releases) page.

## Documentation

- [Quick Start](https://github.com/astropress/astropress/blob/main/docs/QUICK_START.md)
- [Architecture](https://github.com/astropress/astropress/blob/main/docs/ARCHITECTURE.md)
- [Operations](https://github.com/astropress/astropress/blob/main/docs/OPERATIONS.md)
- [API Reference](https://github.com/astropress/astropress/blob/main/docs/API_REFERENCE.md)
- [Web Components](https://github.com/astropress/astropress/blob/main/docs/WEB_COMPONENTS.md)
- [Security](https://github.com/astropress/astropress/blob/main/SECURITY.md)

## License

MIT — see [LICENSE](./LICENSE).
