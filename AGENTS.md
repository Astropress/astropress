# Astropress — Claude Code Context

## Project identity

Astropress is a **web application development framework** built on Astro. It ships a headless
admin panel, a REST API, and a SQLite runtime that host applications compose into their own sites.

It is **not** a CMS or a hosted service. `registerCms()` is the framework's configuration API —
not a CMS product declaration. Never describe Astropress as a CMS or a site builder in docs or
user-facing copy.

## Package structure

```
packages/astropress/        Main npm package (TypeScript source → dist/)
  src/                      All .ts source; tsc emits to dist/ — no .js files here
  pages/ap-admin/           Astro admin pages
  components/               Astro components
  web-components/           Vanilla Custom Elements
  sqlite-runtime/           SQLite reference implementation (SQL lives here)
  adapters/                 Provider adapters (SQL lives here)
crates/astropress-cli/      Rust CLI
  src/commands/             One file per CLI command
  src/js_bridge/            All ProcessCommand::new("node") calls
  src/providers.rs          Provider enums — no imports from commands/ or js_bridge/
packages/astropress-nexus/  Multi-site gateway
packages/docs/              Starlight docs site
tooling/                    Scripts, BDD scenarios, E2E tests, arch-lint
```

## The Vite alias seam

Admin pages import from `"local-runtime-modules"` — a Vite alias the **host app** must
provide. The package never imports host-app paths directly.

```
Astro build (host app)
  └─ Vite → alias: "local-runtime-modules"
      └─ src/astropress/local-runtime-modules.ts  ← written by the host app
          └─ astropress/adapters/sqlite (or cloudflare, supabase, etc.)
```

To add a new storage backend: implement `AstropressPlatformAdapter` in a new
`packages/astropress/src/adapters/` file and export it from the package. No admin
pages or templates change — the seam absorbs the difference.

## Key contracts

| Symbol | Where | Purpose |
|--------|-------|---------|
| `registerCms(config)` | host app startup | Makes `getCmsConfig()` available |
| `AstropressPlatformAdapter` | `src/platform-contracts.ts` | Storage interface all adapters implement |
| `local-runtime-modules` | Vite alias | Resolved by host app to its runtime |
| `withAdminFormAction` / `requireAdminFormAction` | `src/admin-action-utils.ts` | Required ZTA wrapper on every admin action handler |
| `applyAstropressSecurityHeaders` | `src/security-headers.ts` | Must be called from every security entrypoint |

## Development commands

```sh
# Run the full test suite (what CI runs)
bun run test              # arch-lint (TS + Rust) + BDD lint/test + Vitest

# Individual suites
bun run audit:arch        # TypeScript arch boundaries
bun run audit:arch:rust   # Rust arch boundaries
bun run audit:security    # Inline handler / security-header audit
bun run audit:honesty     # Checks README/docs match readiness-truth.json
bun run audit:microcopy   # Banned fallback copy phrases
bun run audit:aeo         # Answer engine optimization checks
bun run bdd:lint          # Validate Gherkin syntax
bun run bdd:test          # Run BDD scenario suite
bun run --filter astropress test          # Vitest unit/integration tests
bun run test:coverage                     # Vitest with coverage thresholds
bun run test:acceptance                   # Playwright E2E
bun run test:accessibility                # axe static audit
bun run test:cli                          # Rust CLI tests
bun run docs:api:check                    # Verify API docs are current
bun run repo:clean                        # Assert clean worktree (runs in CI)
```

> **IMPORTANT:** Never use bare `bun test`. Bun's native runner lacks `vi.hoisted`
> and `vi.stubGlobal`. Always use `bun run --filter astropress test` (Vitest).

## TypeScript arch-lint rules (`tooling/scripts/arch-lint.ts`)

Violations fail CI. Do not introduce them.

| Rule | Constraint |
|------|-----------|
| `no-js-in-src` | No `.js` files in `packages/astropress/src/` or at `packages/astropress/index.js` |
| `max-lines` | Non-exempt TS files ≤ 600 lines (warn at 400). Exempt: `sqlite-bootstrap.ts`, `index.ts`, `project-scaffold.ts`, `cms-route-registry-factory.ts`, `auth-repository-factory.ts`, `runtime-actions-content.ts`, and all files in `sqlite-runtime/`, `import/`, `adapters/` |
| `sql-containment` | `.prepare()` only in `d1-*.ts`, `sqlite-*.ts`, `runtime-actions-*.ts`, `runtime-route-registry-*.ts`, `runtime-admin-auth.ts`, `sqlite-runtime/`, `adapters/`, `import/` |
| `dependency-direction` | `d1-store-*.ts` files must not import from `runtime-*.ts` (adapter layer cannot depend on runtime layer) |
| `dispatch-containment` | `loadLocalAdminStore()` only in `admin-store-dispatch.ts` (and its exempt stubs). Use `withAdminStore()` everywhere else |
| `utility-uniqueness` | `normalizeEmail` and `normalizePath` may only be *defined* in `admin-normalizers.ts` (or received as injected parameters in factory files) |

## Rust arch-lint rules (`tooling/scripts/rust-arch-lint.ts`)

| Rule | Constraint |
|------|-----------|
| `max-lines` | Non-exempt `.rs` files ≤ 600 lines (warn at 300). Exempt: `main.rs`, `args.rs`, `providers.rs`, `env.rs`, `loaders.rs` |
| `command-isolation` | `commands/*.rs` files must not import from other command files — shared logic goes in `commands/import_common.rs` |
| `js-bridge-containment` | `ProcessCommand::new("node")` and `run_node_script()` only in `js_bridge/` files |
| `provider-purity` | `providers.rs` must not import from `commands/` or `js_bridge/` |
| `volatility-boundary` | Import commands (`import_wordpress.rs`, `import_wix.rs`) must not import from `new.rs` or `dev.rs` |

## Security invariants (`tooling/scripts/security-audit.ts`)

Violations fail CI.

- No `<script is:inline>` tags in admin pages or components
- No `on<event>=` inline handler attributes in admin HTML
- No `contenteditable=` in admin/auth surfaces
- No `set:html={pageRecord.body}` (unsafe preview render path)
- No direct `innerHTML =` assignments
- `applyAstropressSecurityHeaders`, `createAstropressSecureRedirect`, or
  `createAstropressSecurityMiddleware` must be called in every security entrypoint:
  - `components/AdminLayout.astro`
  - `src/admin-action-utils.ts`
  - `src/security-middleware-entrypoint.ts`
  - `pages/ap-admin/session.ts`

## Banned phrases (`tooling/readiness-truth.json` + `tooling/scripts/audit-honesty.ts`)

The honesty and microcopy audits scan every committed `.md`, `.mdx`, `.ts`, `.tsx`,
`.astro`, `.feature`, `.rs`, `.yml`, and `.yaml` file. Violations fail CI.

**Legacy hash algorithms** — do not use SHA-2 family names or PBKDF2 when describing
Astropress's own crypto. The internal crypto stack is:

- **Argon2id** — password hashing
- **KMAC256** — token and privacy digests
- **ML-DSA-65** — Astropress outbound webhook signatures

Exception: SHA-256 as a Web Crypto API `hash` parameter for *verifying incoming*
webhook HMAC signatures from third-party services (Formbricks, Typebot, Stripe, etc.)
is legitimate — those providers specify their own algorithm and Astropress must match.
Those files are on the audit allowlist in `tooling/scripts/audit-honesty.ts`.

**Maturity overclaims** — do not use the phrases "fully tested", "production-ready",
"GitHub-ready", or "github-ready" in user-facing text. Use the evaluation rubric grades
to communicate readiness.

**Vague microcopy** — write specific, actionable error messages. Generic fallback phrases
like "Something went wrong" or "An error occurred" are banned from all UI text, CLI
output, and docs. See `tooling/scripts/audit-microcopy.ts` for the exact banned list.
Every error message must identify the problem and suggest what to do next.

## Test pyramid

Write in this order when changing behaviour:

1. **BDD scenario** (`tooling/bdd/*.feature`) — user-visible behaviour in plain language.
   Add or update before touching code. Run `bun run bdd:lint` to validate syntax.
2. **Integration/contract test** (`packages/astropress/tests/*.test.ts`) — real SQLite DB,
   no mocks.
3. **Unit test** — pure functions, parsers, utilities that don't need a DB.

Coverage thresholds (CI-enforced): **97% statements · 97% lines · 97% functions · 80% branches**.
The 80% branch threshold exists only for platform-specific branches (e.g. `process.platform === "win32"`).
All reachable error paths must be tested or the dead code removed.

## CI gate order

```
lint (biome, audit:*, arch, docs:api:check, repo:clean)
  ↓
platform-smoke (ubuntu + macos + windows)  ←─ parallel
test-unit (bun 1.3.10 + latest)            ←─ parallel
test-cli (cargo test)                      ←─ parallel
  ↓
test-e2e (Playwright)
test-build (example, static, BDD, MCP)
  ↓
preview-deploy (PRs only)
```

`repo:clean` runs at the end of `lint` and `test-build` — if any committed file has been
modified by the test suite, CI fails. Tests must not leave dirty worktree state.

## Build output

`tsc -p tsconfig.build.json --noCheck` emits to `packages/astropress/dist/`
(gitignored). `tooling/scripts/add-js-ext.ts` then rewrites extensionless relative
imports to `.js` so the emitted ESM works under Node. Consumers point at
`./dist/src/*.js`; `types` still resolves to `.ts` source — no `.d.ts` needed.

Never commit `.js` files into `packages/astropress/src/`. The `no-js-in-src` arch-lint
rule will catch this.

## Honesty requirements

`tooling/scripts/audit-honesty.ts` verifies that `README.md`,
`docs/reference/EVALUATION.md`, and `packages/docs/src/content/docs/contributing/evaluation.mdx`
all mention Argon2id, KMAC256, and ML-DSA-65. If you rename these algorithms or
remove the mentions, update `tooling/readiness-truth.json` to match.

## Signing setup

**All commits to `main` must be signed.** This is enforced by the GitHub branch
ruleset (`required_signatures`) and caught early by the `verify-signing` pre-commit
hook in `lefthook.yml`.

### One-time local setup

**GPG key (traditional):**
```sh
gpg --list-secret-keys --keyid-format=long   # find your key ID (e.g. 3AA5C34371567BD2)
git config --global user.signingkey 3AA5C34371567BD2
git config --global commit.gpgsign true
```
Upload the public key to GitHub: Settings → SSH and GPG keys → New GPG key.

**SSH key (simpler if you already use SSH for GitHub):**
```sh
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub   # or your key path
git config --global commit.gpgsign true
```
Upload the same public key to GitHub: Settings → SSH and GPG keys → New signing key
(separate from the authentication key).

### Verify a commit is signed
```sh
git log --show-signature -1
```
Look for `gpg: Good signature` or `Good "git" signature`.

### GitHub repo hardening applied
The `Astropress/astropress` repository has the following security settings active.
To inspect or update them use `gh api repos/Astropress/astropress/rulesets/14968184`.

| Setting | Value |
|---------|-------|
| Required signatures | ✓ enforced on default branch |
| Required status checks | `lint`, `test-unit (1.3.10)`, `test-unit (latest)`, `test-cli` |
| Linear history | ✓ (no merge commits) |
| Force push | ✗ blocked |
| Branch deletion | ✗ blocked |
| Web commit signoff | ✓ required |
| Secret scanning | ✓ enabled |
| Secret scanning push protection | ✓ enabled |
| Dependabot security updates | ✓ enabled |
