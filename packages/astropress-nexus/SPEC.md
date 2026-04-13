# astropress-nexus Specification

## Purpose

`astropress-nexus` is a **Hono-based multi-site gateway** for operators who run more than one Astropress site. It provides a single HTTP control plane over all registered sites, handling authentication exchange, fan-out queries, partial-failure isolation, and orchestrated WordPress imports from hosting control panels.

## Package identity

- **Name**: `astropress-nexus`
- **Runtime**: Node.js ≥ 24.8.0 (canonical) / Bun best-effort / any environment that supports the `fetch` API on a best-effort basis
- **Framework**: [Hono](https://hono.dev/) — lightweight, edge-first HTTP framework
- **Port**: `4330` (default, overridden via `PORT` env var)

## Configuration

Configuration is read from a JSON file (default: `nexus.config.json` in the working directory, overridden via `NEXUS_CONFIG` env var).

```json
{
  "dashboardTitle": "Astropress Nexus",
  "sites": [
    {
      "id": "marketing",
      "name": "Marketing Site",
      "baseUrl": "https://marketing.example.com",
      "token": "sk_live_abc123",
      "adminUrl": "https://marketing.example.com/ap-admin",
      "deployHookUrl": "https://deploy.example.com/hooks/marketing",
      "description": "Primary marketing property with the latest launch content."
    },
    {
      "id": "docs",
      "name": "Docs Site",
      "baseUrl": "https://docs.example.com",
      "token": "sk_live_xyz789",
      "adminUrl": "https://docs.example.com/ap-admin",
      "description": "Documentation and release notes site."
    }
  ]
}
```

- `dashboardTitle` is optional and changes the operator UI title.
- `adminUrl`, `deployHookUrl`, and `description` are optional per-site fields used by the Nexus dashboard.

## Auth

- Set `NEXUS_AUTH_TOKEN` to require a bearer token on all routes except `GET /`.
- The `GET /` health endpoint is always public.
- Browser-driven dashboard routes also accept `?token=...` so operators can follow dashboard links and form actions without custom JavaScript.
- Per-site `token` values are never exposed in API responses.

## Endpoints

### Site proxy

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Gateway health — lists all sites + reachability |
| GET | `/dashboard` | Required | Server-rendered operator dashboard with search, summary cards, and bulk actions |
| GET | `/dashboard/sites/{id}` | Required | Operator detail page for a single site |
| GET | `/sites` | Required | List all sites with live health status |
| GET | `/sites/{id}` | Required | Single site metadata + health |
| GET | `/sites/{id}/content` | Required | Proxy → member `/ap-api/v1/content` |
| GET | `/sites/{id}/content/{slug}` | Required | Proxy → member `/ap-api/v1/content/{slug}` |
| GET | `/sites/{id}/media` | Required | Proxy → member `/ap-api/v1/media` |
| GET | `/sites/{id}/settings` | Required | Proxy → member `/ap-api/v1/settings` |
| GET | `/content` | Required | Fan-out GET content from all sites |
| GET | `/metrics` | Required | Aggregate metrics (30 s TTL cache) |

### Import jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/jobs/import/wordpress` | Required | Queue an async WordPress import on a member site |
| GET | `/jobs` | Required | List all jobs, newest first (paginated) |
| GET | `/jobs/:id` | Required | Poll job status |
| POST | `/actions/refresh` | Required | Refresh live health for selected sites and redirect back to the dashboard |
| POST | `/actions/redeploy` | Required | Trigger site deploy hooks for selected sites and redirect back to the dashboard |

### Panel connectors

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/connectors/cloudways/discover` | Required | Discover WordPress apps via Cloudways REST API |
| POST | `/connectors/cpanel/discover` | Required | Discover WordPress installs via Softaculous (cPanel) |
| POST | `/connectors/hpanel/discover` | Required | Discover WordPress plans via Hostinger hPanel |

## Types

### `JobEntry`

```typescript
type JobStatus = "queued" | "running" | "completed" | "failed";

type JobEntry = {
  id: string;           // UUID
  siteId: string;       // member site ID from config
  kind: "import:wordpress";
  status: JobStatus;
  queuedAt: string;     // ISO 8601
  startedAt?: string;
  completedAt?: string;
  result?: unknown;     // AstropressWordPressImportReport on success
  error?: string;       // error message on failure
};
```

Jobs are stored in-memory — they do not survive a Nexus restart. For long-running deployments, monitor the job before the process exits.

### `DiscoveredSite`

```typescript
type DiscoveredSite = {
  siteUrl: string;                        // e.g. "https://my-blog.example.com"
  name: string;                           // human-readable label
  metadata: Record<string, unknown>;      // connector-specific extras
};
```

## Request and response shapes

### `POST /jobs/import/wordpress`

Request body:

```json
{ "siteId": "marketing", "exportFile": "/var/www/marketing/wp-export.xml" }
```

`exportFile` is an absolute path on the **member site's server**, not a local path.
The member site's `POST /ap-api/v1/import/wordpress` endpoint reads it from disk.

Success response (202):

```json
{ "jobId": "a3f1c2e4-7b8d-4f2a-9e1c-3d0f5a6b2c8e", "status": "queued" }
```

### `POST /connectors/cloudways/discover`

Request body:

```json
{ "email": "ops@yourorg.com", "apiKey": "cw_api_key_here" }
```

Success response (200):

```json
{
  "sites": [
    { "siteUrl": "https://blog.example.com", "name": "Blog", "metadata": { "appId": "123", "appType": "wordpress" } }
  ]
}
```

### `POST /connectors/cpanel/discover`

Request body:

```json
{ "host": "cpanel.yourhost.com", "username": "cpanel_user", "password": "cpanel_pass" }
```

Success response (200):

```json
{
  "sites": [
    { "siteUrl": "https://blog.example.com", "name": "https://blog.example.com", "metadata": { "adminUsername": "wpadmin" } }
  ]
}
```

### `POST /connectors/hpanel/discover`

Request body:

```json
{ "accessToken": "hpanel_oauth_bearer_token" }
```

Success response (200):

```json
{
  "sites": [
    { "siteUrl": "https://myblog.example.com", "name": "myblog.example.com", "metadata": { "plan": "premium" } }
  ]
}
```

## Credential handling

Each connector has different access to WordPress admin credentials:

| Connector | Exposes WP credentials? | Notes |
|-----------|------------------------|-------|
| Cloudways | No | Returns site URLs only (`app_fqdn`) |
| cPanel/Softaculous | Yes (in `metadata`) | `adminUsername` is included; password is **not** forwarded |
| hPanel | No | Returns plan domains only |

The panel connectors are discovery tools. Use the discovered `siteUrl` values with the `/jobs/import/wordpress` endpoint to trigger imports (which run on the member site itself with its configured import token).

## Failure modes

| Failure | Behaviour |
|---------|-----------|
| Site unreachable (network error) | `"status": "degraded"` in site entry; other sites unaffected |
| Site returns non-2xx | `"status": "degraded"` with HTTP status in error field |
| Unknown site ID | `404 { "error": "Site 'x' not found" }` |
| Missing / invalid org token | `401 { "error": "Unauthorized" }` |
| Site request timeout (10 s) | Treated as network error → degraded |
| Job site request fails | Job transitions to `"failed"` with error message |
| Connector API unreachable | `502 { "error": "..." }` |

## Running locally

```sh
# From repo root
cd packages/astropress-nexus
cp nexus.config.example.json nexus.config.json
# Edit nexus.config.json with your site URLs and tokens
NEXUS_AUTH_TOKEN=my-secret bun run dev
```

The dashboard is available at `http://localhost:4330/dashboard?token=my-secret` when auth is enabled.

## Tests

```sh
cd packages/astropress-nexus
bunx vitest run
```

The suite covers auth, health, dashboard rendering, bulk actions, proxy routing, fan-out, partial failure, site registry, import job lifecycle (queued/running/completed/failed states), and panel connector discovery (Cloudways, cPanel/Softaculous, hPanel).
