# astropress-nexus Specification

## Purpose

`astropress-nexus` is a **Hono-based multi-site gateway** for operators who run more than one Astropress site. It provides a single HTTP control plane over all registered sites, handling authentication exchange, fan-out queries, and partial-failure isolation.

## Package identity

- **Name**: `astropress-nexus`
- **Runtime**: Node.js ≥ 20 / Bun / any environment that supports the `fetch` API
- **Framework**: [Hono](https://hono.dev/) — lightweight, edge-first HTTP framework
- **Port**: `4330` (default, overridden via `PORT` env var)

## Configuration

Configuration is read from a JSON file (default: `nexus.config.json` in the working directory, overridden via `NEXUS_CONFIG` env var).

```json
{
  "sites": [
    {
      "id": "marketing",
      "name": "Marketing Site",
      "baseUrl": "https://marketing.example.com",
      "token": "sk_live_abc123"
    },
    {
      "id": "docs",
      "name": "Docs Site",
      "baseUrl": "https://docs.example.com",
      "token": "sk_live_xyz789"
    }
  ]
}
```

## Auth

- Set `NEXUS_AUTH_TOKEN` to require a bearer token on all routes except `GET /`.
- The `GET /` health endpoint is always public.
- Per-site `token` values are never exposed in API responses.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Gateway health — lists all sites + reachability |
| GET | `/sites` | Required | List all sites with live health status |
| GET | `/sites/{id}` | Required | Single site metadata + health |
| GET | `/sites/{id}/content` | Required | Proxy → member `/ap-api/v1/content` |
| GET | `/sites/{id}/content/{slug}` | Required | Proxy → member `/ap-api/v1/content/{slug}` |
| GET | `/sites/{id}/media` | Required | Proxy → member `/ap-api/v1/media` |
| GET | `/sites/{id}/settings` | Required | Proxy → member `/ap-api/v1/settings` |
| GET | `/content` | Required | Fan-out GET content from all sites |
| GET | `/metrics` | Required | Aggregate metrics (30 s TTL cache) |

## Failure modes

| Failure | Behaviour |
|---------|-----------|
| Site unreachable (network error) | `"status": "degraded"` in site entry; other sites unaffected |
| Site returns non-2xx | `"status": "degraded"` with HTTP status in error field |
| Unknown site ID | `404 { "error": "Site 'x' not found" }` |
| Missing / invalid org token | `401 { "error": "Unauthorized" }` |
| Site request timeout (10 s) | Treated as network error → degraded |

## Running locally

```sh
# From repo root
cd packages/astropress-nexus
cp nexus.config.example.json nexus.config.json
# Edit nexus.config.json with your site URLs and tokens
NEXUS_AUTH_TOKEN=my-secret bun run dev
```

## Tests

```sh
cd packages/astropress-nexus
bunx vitest run
```

18 tests covering auth, health, proxy routing, fan-out, partial failure, and the site registry.
