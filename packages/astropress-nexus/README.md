# @astropress-diy/nexus

Multi-site gateway for [Astropress](https://astropress.diy) — a single control plane over multiple Astropress sites. Aggregate content, monitor health, trigger redeployments, and run WordPress imports across your entire fleet from one place.

## When to use it

- You manage more than one Astropress site and want a unified dashboard
- You need fan-out queries across sites (e.g. search all sites at once)
- You want to trigger redeploys across multiple sites from a single action
- You host on Cloudways, cPanel, or Hostinger and want automatic site discovery

## Installation

```bash
npm install @astropress-diy/nexus
```

Or run without installing:

```bash
npx @astropress-diy/nexus
```

## Quick start

```ts
import { createNexusApp } from "@astropress-diy/nexus";
import { serve } from "@hono/node-server";

const app = createNexusApp({
  config: {
    title: "My Sites",
    sites: [
      { id: "blog",   name: "Blog",        baseUrl: "https://blog.example.com" },
      { id: "docs",   name: "Docs",        baseUrl: "https://docs.example.com" },
      { id: "store",  name: "Store",       baseUrl: "https://store.example.com" },
    ],
  },
  authToken: process.env.NEXUS_AUTH_TOKEN,
});

serve({ fetch: app.fetch, port: 3000 });
```

Open `http://localhost:3000/dashboard`.

## API

All routes require a `Bearer` token in the `Authorization` header (or `?token=` query param) when `authToken` is configured.

### Sites

| Method | Path | Description |
|---|---|---|
| `GET` | `/sites` | List all registered sites |
| `GET` | `/sites/:id` | Get a single site |
| `GET` | `/sites/:id/content` | List content on a specific site |
| `GET` | `/sites/:id/content/:slug` | Get a content record from a specific site |
| `GET` | `/sites/:id/media` | List media on a specific site |
| `GET` | `/sites/:id/settings` | Get site settings |

### Fleet

| Method | Path | Description |
|---|---|---|
| `GET` | `/content` | Fan-out content query across all sites |
| `GET` | `/metrics` | Aggregate metrics across all sites |
| `POST` | `/actions/refresh` | Re-check health status for selected sites |
| `POST` | `/actions/redeploy` | Trigger redeploy webhook for selected sites |

### Jobs

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs/import/wordpress` | Start a WordPress import job on a site |
| `GET` | `/jobs` | List all import jobs |
| `GET` | `/jobs/:id` | Get a single job |

### Discovery

Automatically register sites from your hosting control panel:

| Method | Path | Description |
|---|---|---|
| `POST` | `/connectors/cloudways/discover` | Discover sites from Cloudways |
| `POST` | `/connectors/cpanel/discover` | Discover WordPress sites from cPanel |
| `POST` | `/connectors/hpanel/discover` | Discover sites from Hostinger hPanel |

### Dashboard

| Path | Description |
|---|---|
| `/dashboard` | Web dashboard — search, inspect, refresh, and redeploy |
| `/dashboard/sites/:id` | Per-site detail page with health and job history |

## License

MIT — see the [Astropress repository](https://github.com/astropress/astropress).
