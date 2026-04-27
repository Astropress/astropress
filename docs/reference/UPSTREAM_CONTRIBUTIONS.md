# Upstream OSS Contribution Requirements

This document tracks upstream changes that would meaningfully improve Astropress — either by removing
workarounds, eliminating whole categories of maintenance burden, or unlocking platform support that is
currently blocked or degraded.

Each item names the project, describes the current pain point, links to the relevant Astropress code,
and states what the upstream change would need to look like.

---

## Bun

### 1. Native test runner: add `vi.hoisted`, `vi.stubGlobal`, and `vi.mock` factory support

**Pain point:** The entire Astropress test suite (1 385 tests, 105 files) runs under [Vitest](https://vitest.dev),
not Bun's built-in test runner. The blocker is that several tests use `vi.hoisted()` (for module-level
constant hoisting before imports are evaluated) and `vi.stubGlobal()` (for patching `globalThis` entries).
Bun's native runner has neither. Running bare `bun test` from the repo root fails with cryptic import
errors; CI must use `bun run --filter astropress test` which shells out to Vitest.

**Astropress code:** `packages/astropress/vitest.config.ts`, all `tests/*.test.ts` files,
`CONTRIBUTING.md` warning note.

**Upstream ask:**
- Implement `vi.hoisted(fn)` semantics in `bun:test` (hoist the factory's return value to before the
  module's own imports resolve).
- Implement `bun:test`'s equivalent of `vi.stubGlobal(key, value)`.
- Implement `mock.module(path, factory)` with full factory support.

Once these land, the Vitest dependency can be dropped, `bunx vitest run` replaced with `bun test`, and
the `vitest.config.ts` file deleted. The dual-runner documentation warning in `CONTRIBUTING.md` can
be removed.

**Reference:** https://github.com/oven-sh/bun/issues/1825

---

### 2. `bun build --compile`: embed arbitrary static files in single-binary CLI apps

**Pain point:** The Astropress CLI (`crates/astropress-cli/`) is written in Rust specifically because
`bun build --compile` cannot embed arbitrary directory trees into a self-contained binary. The CLI uses
the Rust crate `include_dir!` to embed the scaffold template at compile time
(`crates/astropress-cli/src/scaffold.rs:9`). If Bun's compiler supported the equivalent of
`Bun.embeddedFiles` for whole directory trees, the CLI could be rewritten in TypeScript.

**Astropress code:** `crates/astropress-cli/src/scaffold.rs`.

**Upstream ask:**
- `bun build --compile` should accept a `--asset-dir path` flag (or equivalent `Bun.plugin` API) that
  embeds an entire directory tree into the compiled binary, accessible at runtime via
  `Bun.file(import.meta.dir + "/embedded/...")`.
- The embedded files should be readable as `Buffer`/`ReadableStream` with their original directory structure.

**Reference:** https://github.com/oven-sh/bun/issues/13743

---

### 3. Workspace root discovery: support non-root `package.json` in polyglot monorepos

**Pain point:** Bun's workspace root must be the directory from which `bun install` is invoked. In a
polyglot monorepo (Rust + TypeScript), the natural layout puts JS packages under `packages/` and Rust
crates under `crates/`, with neither language owning the repo root. The ideal structure would have
`packages/package.json` define the Bun workspace, keeping `bun.lock` and `node_modules/` inside
`packages/` where they belong — but running `bun install` from the git root would then fail to find
the workspace, so `package.json` and `bun.lock` must remain at the git root regardless.

**Astropress code:** Root `package.json` and `bun.lock` are forced to stay at the git root despite all
JS code living in `packages/`. See the layout notes in `README.md` and `docs/reference/ARCHITECTURE.md`.

**Upstream ask:**
- Support a `bunfig.toml` field (e.g. `workspaceRoot = "./packages"`) that lets the git root declare
  where the actual Bun workspace lives, so `bun install` run from the git root discovers
  `packages/package.json` as the workspace manifest.
- Alternatively: when `bun install` finds no `package.json` at the current directory, walk down into
  subdirectories to find the nearest workspace root (similar to how Cargo resolves workspaces).
- This would allow polyglot repos to place `bun.lock` and `node_modules/` inside `packages/`, keeping
  the git root free of JS-specific lockfiles.

---

### 4. `bun:sqlite` — `exec()` should apply `PRAGMA journal_mode = WAL`

**Pain point:** In both `bun:sqlite` and `node:sqlite`, calling `db.exec("PRAGMA journal_mode = WAL")`
silently has no effect — WAL mode is never actually applied. The workaround is
`db.prepare("PRAGMA journal_mode = WAL").get()`, which forces the statement through the full
prepare→step→finalize cycle and consumes the result row. This is non-obvious and undocumented.

**Astropress code:** `packages/astropress/src/sqlite-bootstrap.ts` lines 298-302, with a comment
explaining the workaround.

**Upstream ask:**
- `Database.exec(sql)` in `bun:sqlite` should correctly execute PRAGMA statements that return result rows,
  including `journal_mode`, `wal_checkpoint`, and `integrity_check`. The returned rows may be discarded
  but the statement must be fully stepped.
- Alternatively, document that `exec()` is not safe for result-returning PRAGMAs and that `prepare().get()`
  must be used.

---

## Astro

### 4. `injectRoute` should accept `.ts` entrypoints directly

**Pain point:** Astro's `injectRoute()` integration API requires a JavaScript or `.astro` file path as
the `entrypoint`. TypeScript files are rejected. This forces Astropress to hand-maintain `.js` companion
files for every injected route under `packages/astropress/pages/` alongside the `.ts` source.

> **Scope note (2026-04-13):** `src/` was migrated to tsc-into-`dist/`, so the `.ts`/`.js`
> duplication there is gone. The remaining duplication is narrower — it only affects route
> entrypoints under `pages/` that `injectRoute` loads directly.

**Astropress code:** `packages/astropress/src/admin-app-integration.ts` (all `injectRoute` calls use
`.js` paths), `packages/astropress/pages/**/*.{ts,js}` pairs.

**Upstream ask:**
- `injectRoute({ entrypoint: "path/to/file.ts" })` should work, with Astro (via Vite) handling the
  TypeScript transform the same way it does for host-app pages.
- This would eliminate the remaining hand-authored `.js` companions for route entrypoints.

**Reference:** https://github.com/withastro/astro/issues/9567

---

### 5. Integration API for serving static package assets in dev mode

**Pain point:** When an Astro integration injects routes (e.g. admin UI pages), those pages can reference
static assets (CSS, fonts, images) that live inside the integration package's own `public/` directory.
There is no Astro integration API to declare these assets — the integration must manually register a
Vite middleware in `astro:server:setup` to serve them in dev, and copy them in `astro:build:done` for
production. This is fragile and non-obvious.

**Astropress code:** `packages/astropress/src/admin-app-integration.ts` lines 17-30 (the
`createReadStream` + `server.middlewares.use` hack for `admin.css`) and lines 32-41 (the `copyFile`
call in `astro:build:done`).

**Upstream ask:**
- Add an `injectStaticAsset(options: { path: string; url: string })` method to the Astro integration
  setup context, analogous to `injectRoute`, that declares a file from the integration package as a
  static asset available at a given URL in both dev and production.
- Or: extend `injectRoute` to also serve sibling assets from the entrypoint's directory.

**Reference:** https://github.com/withastro/astro/issues/9825

---

## Cloudflare D1

### 6. Native SQL transaction support (`BEGIN` / `COMMIT` / `ROLLBACK`)

**Pain point:** Cloudflare D1 does not support traditional SQL transactions via `db.exec("BEGIN")` or
prepared `BEGIN`/`COMMIT` statements. The only atomic multi-statement primitive is `db.batch([...])`,
which executes a fixed list of statements atomically but cannot branch mid-transaction based on
intermediate query results. This means operations that require "read then conditionally write" atomicity
(e.g. lock acquisition) cannot be made truly atomic on D1 the way they are on SQLite via
`BEGIN IMMEDIATE`.

**Astropress code:**
- `packages/astropress/src/sqlite-runtime/locks.ts` — uses `BEGIN IMMEDIATE`/`COMMIT` on SQLite (fully
  atomic). The equivalent Cloudflare adapter path has no lock table at all because it cannot be
  implemented atomically with D1's current API.
- `packages/astropress/src/adapters/cloudflare-auth.ts` — uses `db.batch()` as a workaround for
  sign-in and sign-out, but cannot do read-then-conditional-write atomically.
- `packages/astropress/src/d1-database.ts` — the `D1DatabaseLike` interface exposes `batch()` but
  has no `transaction()` method.

**Upstream ask:**
- Add `db.transaction(fn: (tx: D1Transaction) => Promise<void>): Promise<void>` to the D1 API, where
  `D1Transaction` exposes `prepare()` and `batch()` within an atomic scope.
- Or: support `db.prepare("BEGIN IMMEDIATE").run()` / `db.prepare("COMMIT").run()` as valid operations
  within a Workers request context.

**Reference:** https://github.com/cloudflare/workers-sdk/issues/3159

---

## crossterm / ratatui

### 7. BSD platform support (FreeBSD, NetBSD, OpenBSD)

**Pain point:** The Astropress CLI TUI (interactive wizard, import dashboard) uses `ratatui` and
`crossterm`. Both crates compile on BSD via the `unix` family but are untested and unsupported there.
`crossterm`'s terminal detection (`is_terminal()`, raw-mode activation) has known issues on some BSD
terminal emulators, and neither crate's CI matrix includes any BSD target. There are no prebuilt CLI
binaries for BSD in the `cli-release.yml` workflow because GitHub Actions has no hosted BSD runners
and the Rust toolchain's `x86_64-unknown-freebsd` target is Tier 2 (no prebuilt std).

**Astropress code:**
- `crates/astropress-cli/Cargo.toml` — `ratatui = "0.29"`, `crossterm = "0.28"`
- `crates/astropress-cli/src/tui/import_dashboard.rs` — TUI entry point
- `.github/workflows/cli-release.yml` — no BSD targets in the build matrix

**Upstream ask (crossterm):**
- Add FreeBSD to the CI test matrix (can use `cross` with QEMU or GitHub's macOS runners as a proxy).
- Audit and fix `is_terminal()` on BSDs that use `/dev/pts`-style terminal detection.
- Publish a documented support tier for BSD targets.

**Upstream ask (ratatui):**
- Inherit crossterm's BSD fixes once crossterm supports it.
- Add a `--plain` / non-TUI rendering path for environments where raw-mode activation fails, so
  callers can detect the failure gracefully rather than panicking.

**Upstream ask (rust-lang/rust):**
- Promote `x86_64-unknown-freebsd` to Tier 2 with a hosted runner or prebuilt std distribution
  so cross-compilation and CI are practical.

**What would let Astropress promote BSD from best-effort to verified support:**
- A self-hosted FreeBSD runner (or another reliable BSD CI target) that can run `bun install`, `cargo test`, and the non-browser smoke commands from `docs/COMPATIBILITY.md`
- `crossterm` fixes for BSD raw-mode activation and terminal detection so the TUI path is not limited to `--plain`
- `ratatui` behavior that degrades cleanly to the existing plain-text fallback when raw mode cannot be enabled
- A practical Rust toolchain path for BSD release artifacts, either via upstream target promotion or a reproducible cross-compilation pipeline
- One repeatable maintainer-owned validation pass covering install, scaffold, CLI completions, and plain-mode import/doctor flows on native BSD

**Reference:**
- https://github.com/crossterm-rs/crossterm/issues/685
- https://github.com/ratatui/ratatui/discussions/1046

---

## Node.js

### 8. Stabilize `node:sqlite` (remove ExperimentalWarning)

**Pain point:** `node:sqlite`'s `DatabaseSync` is still flagged experimental in Node.js 20/22, producing
`ExperimentalWarning: SQLite is an experimental feature` on every test run. Astropress uses it as the
fallback SQLite driver when not running under Bun. The experimental status means the API surface could
change between Node minor versions.

**Astropress code:** `packages/astropress/src/sqlite-bootstrap.ts` lines 177-180, all
`tests/*.test.ts` files (the warning is visible in test output).

**Upstream ask:**
- Graduate `node:sqlite` to stable in Node 22 LTS or Node 24.
- Confirm that `DatabaseSync.exec()` fully steps result-returning PRAGMA statements (see Bun item #3
  above — the same bug may exist here).

**Reference:** https://github.com/nodejs/node/issues/53264

---

## Stryker (`stryker-mutator/stryker-js`)

Pain points discovered during the 2026-04-27 full mutation run on
`chore/process-improvements-from-pr64` (16 876 mutants, 6 h+ runtime, 0.3 % cache
reuse). The combined effect made a routine baseline refresh effectively unusable
on a developer machine.

### 9. Incremental cache invalidates whole files on any content change

**Pain point:** Stryker's incremental cache hashes by file content, so a
formatting-only or import-only edit invalidates every mutant in the file. A
persistence refactor (Astropress PR #61) renamed an import across 211 src files;
none of the behavioural mutants on those files actually changed, but Stryker
marked 16 771 of 16 876 mutants "new" and reused only 51. The next run paid a
multi-hour cold-start cost.

**Astropress code:** `tooling/stryker/stryker.config.mjs`,
`.stryker-incremental.json` (gitignored).

**Upstream ask:**
- Key incremental identity by AST node + mutator + position-within-AST instead
  of whole-file content hash, so import-only or whitespace-only edits don't
  invalidate behavioural mutants whose AST surface is unchanged.

---

### 10. `ignoreStatic` is incompatible with `coverageAnalysis: "all"`

**Pain point:** `ignoreStatic: true` is rejected at config-validation time when
`coverageAnalysis` is `"all"` — but `"all"` is the fastest dry-run mode.
Switching to `"perTest"` to gain `ignoreStatic`'s ~15 % static-mutant cut adds
significant per-mutant overhead (see #11).

**Astropress code:** `tooling/stryker/stryker.config.mjs` — we currently set
`coverageAnalysis: "perTest"` solely to satisfy this constraint.

**Upstream ask:**
- Make `ignoreStatic` orthogonal to coverage mode. Static-mutant detection is an
  AST property and doesn't require per-test coverage data.

---

### 11. Per-mutant test transform is repeated, not cached

**Pain point:** Log lines under the `vitest-runner` show `transform 10.79s` on
every per-mutant test run, even though the mutated source change is a one-line
edit and the test files themselves are unchanged. Vitest's compiled test modules
appear to be re-built per mutant.

**Astropress code:** affects every `bun run test:mutants` invocation; visible in
`/tmp/stryker-run.log` excerpts during the 2026-04-27 run.

**Upstream ask (`@stryker-mutator/vitest-runner`):**
- Cache compiled test modules across mutants. Only the mutated source module
  needs re-compilation; downstream test-file transforms can be reused.

---

### 12. Worker SIGSEGV recovery is silent and lossy

**Pain point:** Long runs hit periodic worker SIGSEGV crashes (likely Vitest +
Node 24 interaction). Stryker spawns a replacement worker, but:
- No user-facing summary ("N worker crashes recovered, M mutants retried").
- In-flight mutants on the dead worker are retried from scratch — no checkpoint.
- The crash event surfaces only via stderr stack trace, easy to miss.

**Astropress code:** observed during `bun run test:mutants` runs; multiple worker
crashes per multi-hour run.

**Upstream ask:**
- Persist per-mutant results incrementally as they complete. On worker death,
  re-run only the unfinished mutants assigned to that worker.
- Surface a counter in the final report and exit summary: "X workers restarted,
  Y mutants retried, Z mutants lost (if any)."

---

### 13. No live progress reporting during the mutation phase

**Pain point:** With `clear-text` reporter the mutation phase is silent until
the run completes. On a 6 h run there is no way to distinguish "still working"
from "hung" without inspecting `ps` CPU times of the worker processes.

**Astropress code:** every `bun run test:mutants` invocation.

**Upstream ask:**
- Add a `--progress` flag (or a streaming reporter) that prints
  "killed/survived/timeout: N/M (P % complete, ETA Y)" every ~30 s during the
  mutation phase, similar to `cargo test`'s test-counter output.

---

### 14. Incremental cache is local-only by design — no shared-state pattern

**Pain point:** `.stryker-incremental.json` is intended to be gitignored, so
every machine and CI runner pays first-run cost independently. Multiple
developers + CI all redo the same work. After Astropress PR #61, every
contributor would have hit the same 6 h cold-start.

**Astropress code:** `.gitignore` line 24 (`**/.stryker-incremental*.json`); we
plan to build `tooling/scripts/run-mutants-shared.ts` to wrap Stryker with a
GitHub-release-asset shared store + lock branch.

**Upstream ask:**
- Document a "remote state" pattern (analogous to Terraform remote state).
- Add a `stateUri` config option that fetches the incremental file at run start
  and pushes it back at run end, with a pluggable backend (S3/GCS/GitHub
  release/HTTP PUT).
- Include a lock primitive so two simultaneous runs don't overwrite each
  other's state.

---

## Summary table

| Project | Change | Astropress benefit |
|---|---|---|
| Bun | `vi.hoisted` / `vi.stubGlobal` in `bun:test` | Drop Vitest; use `bun test` everywhere |
| Bun | `bun build --compile` embedded asset dirs | Rewrite CLI in TypeScript; eliminate Rust |
| Bun | `workspaceRoot` in `bunfig.toml` | Move `bun.lock` + `node_modules` into `packages/` |
| Bun / Node | `exec()` applies WAL PRAGMA correctly | Remove undocumented `prepare().get()` workaround |
| Astro | `injectRoute` accepts `.ts` entrypoints | Eliminate 105 hand-authored `.js` companions |
| Astro | `injectStaticAsset()` integration API | Remove manual Vite middleware + copy-file hooks |
| Cloudflare D1 | SQL transaction support | Atomic lock acquisition on Cloudflare adapter |
| crossterm | BSD terminal support | CLI works on FreeBSD/NetBSD/OpenBSD |
| ratatui | Graceful non-TUI fallback | CLI degrades cleanly on unsupported terminals |
| Node.js | Graduate `node:sqlite` to stable | No ExperimentalWarning; stable API contract |
| Stryker | AST-keyed incremental identity | Import/format edits stop invalidating whole files |
| Stryker | `ignoreStatic` works with `coverageAnalysis: "all"` | Faster dry-run + static-mutant skip together |
| Stryker (`vitest-runner`) | Cache compiled test modules across mutants | Eliminate per-mutant transform overhead |
| Stryker | Checkpoint per-mutant results; surface worker-crash counters | Multi-hour runs survive SIGSEGV without silent loss |
| Stryker | Live `--progress` reporter | Distinguish "working" from "hung" on long runs |
| Stryker | Remote-state config + lock for incremental file | Devs + CI share cache; no per-machine cold start |
