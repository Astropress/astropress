# Astropress — Claude Code Context

## Project identity

Astropress is a **web application development framework** built on Astro. It ships a headless
admin panel, a REST API, and a SQLite runtime that host applications compose into their own sites.
It is **not** a CMS or a hosted service — `registerCms()` is the framework's configuration API.

## Key contracts

- `registerCms(config)` — called once at host app startup; makes `getCmsConfig()` available
- `AstropressPlatformAdapter` — the storage interface all adapters implement
- `local-runtime-modules` — Vite alias the host app must provide; resolves to its SQLite store
- All `.ts` source files in `src/` have paired `.js` companions; `audit:sync` enforces parity

## Development commands

```sh
bun test                  # arch-lint + BDD + Vitest (full suite)
bun run audit:arch        # TypeScript architectural fitness functions
bun run audit:arch:rust   # Rust architectural fitness functions
bun run audit:sync        # Check TS/JS export parity
cargo test --manifest-path crates/Cargo.toml
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full test pyramid and PR checklist.

## Invariants the tests enforce

- All admin action handlers use `withAdminFormAction` or `requireAdminFormAction` (ZTA)
- No inline event handlers (`onclick=`, `onsubmit=`) in admin HTML (XSS)
- SQL is contained to `src/sqlite-runtime/` and `src/adapters/` (arch-lint)
- LOC limits: main TS files ≤ 600 lines, Rust command files ≤ 600 lines
- JS/TS exports match across all `.ts`/`.js` pairs (audit:sync)
