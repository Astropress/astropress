# Astropress — Claude Code Context

## Project identity

Astropress is a **web application development framework** built on Astro. It ships a headless
admin panel, a REST API, and a SQLite runtime that host applications compose into their own sites.
It is **not** a CMS or a hosted service — `registerCms()` is the framework's configuration API.

## Architecture

```
packages/astropress/          # Core framework package
  src/                        # TypeScript source (paired .ts/.js)
  pages/ap-admin/             # Admin UI pages and action endpoints
  pages/ap-api/v1/            # REST API endpoints
  components/                 # Astro components (SEO, JSON-LD, etc.)
  web-components/             # Vanilla Web Components

crates/astropress-cli/        # Rust CLI (astropress new/doctor/import)
  src/commands/               # One file per command; shared logic in import_common.rs

packages/astropress-mcp/      # MCP server (7 tools for AI agents)

scripts/                      # arch-lint, bdd-test, check-js-sync, bundle-audit
features/                     # Gherkin BDD scenarios
```

## Key contracts

- `registerCms(config)` — called once at host app startup; makes `getCmsConfig()` available
- `AstropressPlatformAdapter` — the storage interface all adapters implement
- `local-runtime-modules` — Vite alias the host app must provide; resolves to its SQLite store
- All `.ts` source files in `src/` have paired `.js` companions; `audit:sync` enforces parity

## Development commands

```sh
bun test                  # arch-lint + BDD + Vitest (full suite)
bun run --filter astropress test   # Vitest only
bun run audit:arch        # TypeScript architectural fitness functions
bun run audit:arch:rust   # Rust architectural fitness functions
bun run audit:sync        # Check TS/JS export parity
cargo test --manifest-path crates/astropress-cli/Cargo.toml
```

## Invariants the tests enforce

- All admin action handlers use `withAdminFormAction` or `requireAdminFormAction` (ZTA)
- No inline event handlers (`onclick=`, `onsubmit=`) in admin HTML (XSS)
- SQL is contained to `src/sqlite-runtime/` and `src/adapters/` (arch-lint)
- LOC limits: main TS files ≤ 600 lines, Rust command files ≤ 600 lines
- JS/TS exports match across all `.ts`/`.js` pairs (audit:sync)

## REST API

Bearer token auth at `/ap-api/v1/`. Requires `api.enabled: true` in `registerCms()`.

Endpoints: `content`, `content/{id}`, `media`, `media/{id}`, `revisions/{recordId}`,
`settings`, `webhooks`, `openapi.json`.

OpenAPI spec: `GET /ap-api/v1/openapi.json` — no auth required.

## MCP server

```sh
cd packages/astropress-mcp && bun run build
# env: ASTROPRESS_API_URL, ASTROPRESS_API_TOKEN
```

Tools: `list_content`, `get_content`, `create_content`, `update_content`,
`list_media`, `get_site_settings`, `get_health`.

## Commit conventions

Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
Never skip pre-commit hooks (`--no-verify`). Never amend published commits.
