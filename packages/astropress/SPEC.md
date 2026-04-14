# Astropress Package Specification

## Scope

This spec covers the published npm package currently located at `packages/astropress`.

If Astropress later splits into multiple repositories, this file should move with the package repo.

## Responsibilities

The package is responsible for:

- the reusable web-app runtime surface for relatively simple websites
- provider-neutral contracts
- host-facing integration helpers
- admin components and shared models
- package-owned admin UI defaults with host override hooks for branding, labels, favicon, logo, navigation naming, and optional custom stylesheet loading
- runtime utilities used by consuming Astro sites
- packaged local runtime assets such as the SQLite schema/bootstrap/runtime path
- package-owned provider recommendation logic for non-technical setup flows
- package-owned project launch planning so CLI and consumers share one runtime/bootstrap decision path

## v0 Stability Policy

Astropress is pre-1.0. The `AstropressProviderContract` TypeScript interface is the primary public API surface. In v0, all types are subject to breaking change with notice in [CHANGELOG.md](../../CHANGELOG.md).

The package exports a `PROVIDER_CONTRACT_VERSION` string constant (e.g. `"0.1"`) so consumers can assert compatibility at runtime:

```ts
import { PROVIDER_CONTRACT_VERSION } from "astropress";
if (PROVIDER_CONTRACT_VERSION !== "0.1") {
  throw new Error(`Unsupported provider contract version: ${PROVIDER_CONTRACT_VERSION}`);
}
```

Once the package reaches v1.0, it will follow semantic versioning strictly and the contract will be considered stable.

## Package Contract

The package must expose stable import paths for:

- the main public API from `astropress`
- host integration helpers from `astropress/integration`
- hosted provider assembly from `astropress/hosted-platform-adapter`
- first-party provider adapters from `astropress/adapters/*`
- deploy/import/sync workflows from `astropress/deploy/*`, `astropress/import/*`, and `astropress/sync/*`
- host-runtime seam typing from `astropress/host-runtime-modules`
- typed local seam contracts from `astropress/local-runtime-modules`
- provider/runtime stubs needed by consuming apps
- current host-facing runtime modules during extraction

The package should reduce host-specific glue over time by replacing temporary seams with real provider adapters.

## Current Runtime State

- `astropress/adapters/sqlite` is a first-party SQLite-backed adapter, not a placeholder capability shim
- `astropress/hosted-platform-adapter` is the package-owned assembly surface for hosted provider runtimes built from explicit stores
- `astropress/adapters/local` chooses the local SQLite-backed provider runtime for sqlite or Supabase
- `astropress/adapters/hosted` chooses the hosted provider runtime for Supabase and other hosted providers
- `astropress/adapters/project` chooses local or hosted runtime mode from the project env contract
- `astropress/project-launch` converts the project env and runtime mode into one launch/bootstrap plan
- `astropress/import/wordpress` owns a staged WordPress import pipeline with typed inspection, plan generation, artifact output, remediation reporting, and resumable media download state
- provider selectors must support explicit env maps as well as ambient process env
- `astropress/adapters/supabase-sqlite` provides a Node-only provider-local runtime backed by the packaged SQLite adapter
- Supabase hosted config loading and runtime guards are package-owned, not host-app glue
- `astropress/sqlite-bootstrap` owns the packaged schema/bootstrap path for local admin databases
- `astropress/sqlite-admin-runtime` owns the packaged Node SQLite admin runtime
- Node-only runtime entry points stay on explicit subpaths and must not leak through the root package API into Cloudflare builds

## Design Constraints

- no provider-specific editorial behavior in shared admin templates
- no git-first authoring requirement
- support non-technical editors
- target individuals and small organizations running relatively simple sites
- do not drift into a generic site-builder product model
- support GitHub Pages, Cloudflare, and Supabase through stable contracts
- keep published entry points stable once consumers adopt them

## Session Secret Rotation

Astropress supports single-step session secret rotation without a schema change.

- `SESSION_SECRET` signs newly created package/runtime-managed admin sessions
- `SESSION_SECRET_PREV`, when present, is accepted only for validating or revoking pre-rotation sessions
- `CLOUDFLARE_SESSION_SECRET` signs newly created Cloudflare adapter sessions
- `CLOUDFLARE_SESSION_SECRET_PREV`, when present, is accepted only for validating or revoking pre-rotation Cloudflare sessions

The package must never write new sessions with a previous secret. Previous secrets exist only as a temporary compatibility window during rotation.

## Extraction Goal

Consuming apps should eventually depend only on published Astropress package entry points, not repo-relative source paths.

## Newsletter / Email Integration

Astropress uses **Listmonk** exclusively as its newsletter delivery backend. Mailchimp is not supported as a delivery mode — operators who previously used Mailchimp should migrate subscribers to Listmonk (see below).

### Why Listmonk only

- Self-hosted, MIT-licensed, zero per-subscriber fees
- Operator owns the subscriber list and campaign data
- No third-party SaaS dependency in the runtime path
- Consistent with the project's privacy-by-design posture

### Runtime behavior

- `NEWSLETTER_DELIVERY_MODE` defaults to `"listmonk"` in production and `"mock"` in development/test
- The `mock` mode always returns `{ ok: true }` without calling any API — safe for local dev and CI
- Any value other than `"listmonk"` falls through to mock

### Required env vars (production)

| Variable | Description |
|---|---|
| `NEWSLETTER_DELIVERY_MODE` | Must be `"listmonk"` |
| `LISTMONK_API_URL` | Base URL of your Listmonk instance (e.g. `https://listmonk.example.com`) |
| `LISTMONK_API_USERNAME` | Listmonk admin username |
| `LISTMONK_API_PASSWORD` | Listmonk admin password |
| `LISTMONK_LIST_ID` | Numeric ID of the list subscribers are added to |

### Setup guide generation

When a project is scaffolded with `--email` (or email is chosen in the interactive wizard), `astropress new` writes a `LISTMONK.md` file to the project root. This guide covers:
- Deploying Listmonk to Fly.io or Railway (free tier)
- Creating an admin account and a subscriber list
- Obtaining the list ID
- Configuring the required env vars
- Testing locally with `NEWSLETTER_DELIVERY_MODE=mock`

### Mailchimp subscriber migration

Operators moving from Mailchimp can export their audience as CSV from the Mailchimp dashboard and bulk-import into Listmonk via its REST API (`POST /api/subscribers/import`). The import accepts a JSON payload of subscriber records. See the "Mailchimp import" section below for details.

## Donation Integrations

Astropress supports three donation / fundraising providers that site owners can enable through `registerCms()`.

### Providers

- **GiveLively** — fiat donations for US nonprofits; embedded JavaScript widget; suppressed when visitor has opted out of tracking (DNT/GPC)
- **Liberapay** — recurring fiat donations popular in OSS communities; static HTML button with no external JavaScript; never suppressed (no tracker)
- **PledgeCrypto** — crypto donations with automatic carbon offsets per transaction via the UN Climate Neutral Now Initiative; embedded JavaScript widget; suppressed when visitor has opted out of tracking (DNT/GPC)

All three providers block iframe embedding (`X-Frame-Options: SAMEORIGIN`). The admin fundraising page therefore uses link-mode cards pointing to the live `/donate` page rather than iframes.

### Admin depth

The admin panel's fundraising page shows one link card per enabled provider, linking to the live `/donate` page. This is sufficient for operators to verify configuration without an iframe.

### /donate page generation

When one or more donation providers are configured during `astropress new`, the scaffold generates a `src/pages/donate.astro` page containing:

- The provider widgets in order: GiveLively, Liberapay, PledgeCrypto
- A schema.org `DonateAction` JSON-LD block (improves AEO discoverability)
- DNT/GPC consent checks: GiveLively and PledgeCrypto widgets are suppressed when the visitor has opted out; Liberapay is never suppressed

### Config shape

```typescript
interface GiveLivelyConfig {
  orgSlug: string;        // GIVELIVELY_ORG_SLUG env var
  campaignSlug?: string;  // GIVELIVELY_CAMPAIGN_SLUG env var (optional)
}
interface LiberapayConfig {
  username: string;       // LIBERAPAY_USERNAME env var
}
interface PledgeCryptoConfig {
  partnerKey: string;     // PLEDGE_PARTNER_KEY env var
}
interface DonationsConfig {
  giveLively?: GiveLivelyConfig;
  liberapay?: LiberapayConfig;
  pledgeCrypto?: PledgeCryptoConfig;
}
```

`DonationsConfig` is available as `donations` in `CmsConfig` (passed to `registerCms()`). Multiple providers can be enabled simultaneously. Polar (developer sponsorships) is handled separately through the Polar.sh integration and is not part of this config surface.
