# Contributing to Astropress

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | 1.3.10 | `curl -fsSL https://bun.sh/install | bash` |
| Node.js | 20+ | `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash` then `nvm install 20 && nvm use 20 && nvm alias default 20` |
| Rust | 1.82+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Playwright browsers | latest | `npx playwright install --with-deps chromium` |

Alternatively, open the repo in VS Code and select **Reopen in Container** — the devcontainer handles all prerequisites automatically.

Or run the bundled installer, which provisions all of the above (Bun, nvm + Node 20, Rust, Playwright browsers) and then runs the test suite:

```bash
bash tooling/scripts/install.sh           # macOS / Linux / *BSD
# or on Windows PowerShell:
pwsh tooling/scripts/install.ps1
```

Pass `--skip-tests` to skip the post-install test run, or `--skip-playwright` to skip browser download.

## Setup

```bash
bun install
npx playwright install --with-deps chromium
```

## Running tests

```bash
bun run test              # full suite: arch lint, BDD, unit tests
bun run test:coverage     # unit tests with 97% coverage thresholds
bun run test:acceptance   # Playwright + axe end-to-end
bun run test:cli          # Rust CLI tests (cargo test)
bun run test:accessibility # static-site axe audit
bun run audit:arch        # architecture boundary checks
bun run audit:sync        # .ts/.js export parity check (see below)
```

> **Important:** always use `bun run <script>` (not bare `bun test`) for running tests.
>
> Bare `bun test` uses Bun's native test runner which lacks `vi.hoisted` and `vi.stubGlobal` —
> APIs that the Astropress test suite relies on. CI uses `bun run --filter astropress test`
> which invokes Vitest (the correct runner) via the `packages/astropress/package.json` `test`
> script. Running `bun test` in the repo root will fail with confusing import errors.

### Test pyramid

Write tests in this order, from outermost in:

1. **BDD scenario** (`features/*.feature`) — describes the user-visible
   behaviour in plain language. Add or update one before touching code.
2. **Integration / contract test** (`tests/*.test.ts`) — exercises a
   real SQLite DB or provider adapter; no mocks.
3. **Unit test** — for pure functions, parsers, and utilities that don't
   need a DB.

Coverage gates (enforced in CI): **97% statements, 97% lines, 97% functions,
80% branches**. Branch coverage is deliberately lower — dead branches in
error paths are acceptable; missing feature branches are not.

To add a BDD scenario:

```gherkin
# tooling/bdd/content/scheduling.feature
Scenario: Editor schedules a post for future publication
  Given I am logged in as an editor
  When I set the post's publish time to tomorrow at 9am
  Then the post status becomes "scheduled"
  And the post appears in the Scheduled tab
```

Run `bun run bdd:lint` to validate Gherkin syntax before committing.

## The dual `.ts` / `.js` file pattern

Most source files in `packages/astropress/src/` appear in pairs:

- `foo.ts` — TypeScript source (typed development, test suite, type checking)
- `foo.js` — pre-compiled JavaScript (what consumers without a TypeScript build step import)

**The `.js` files are not generated.** They are committed alongside the `.ts` files and must be kept in sync manually. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#the-dual-ts--js-file-pattern) for why.

**The rule:** whenever you edit a `.ts` file that has a `.js` sibling, you must also update the `.js` file to match.

**Quick regen helper:** if you have made changes to `.ts` files and want to regenerate all `.js` files in one shot, run from the repo root:

```bash
bun run sync:js
```

This wraps `tsc -p packages/astropress/tsconfig.build.json --noCheck` followed by the `add-js-ext.ts` pass that rewrites import paths. After running it, verify the results:

```bash
bun run audit:sync
```

The `audit:sync` script checks export-level divergence — if you add a new exported symbol to a `.ts` file and forget the `.js`, CI will fail.

Files that are `.ts`-only (no `.js` sibling) do not need this treatment — they are consumed exclusively through the TypeScript compiler path.

## Architecture boundaries

The `audit:arch` script enforces cross-project import rules. Run it before opening a PR:

```bash
bun run audit:arch
```

Never import host-app paths directly from `packages/astropress/`. All runtime dependencies must go through the `"local-runtime-modules"` Vite alias seam.

## BDD feature files

Acceptance behaviour is documented in `tooling/bdd/`. Before opening a PR that changes user-visible behaviour, add or update a scenario:

```gherkin
# tooling/bdd/content/posts.feature
Scenario: Editor publishes a draft post
  Given I am logged in as an editor
  When I open a draft post and click "Publish"
  Then the post status becomes "published"
```

Run `bun run bdd:lint` to validate feature file syntax.

## Commit conventions

- One logical change per commit
- Present-tense imperative subject line (`Add focus trap to confirm dialog`)
- Reference the feature file or test if the change is behaviour-driven

## Opening a pull request

1. `bun run test` — all tests pass
2. `bun run audit:arch` — no boundary violations
3. `bun run audit:sync` — no .ts/.js divergence
4. `bunx biome check packages/astropress/src` — zero lint errors
5. Open the PR; CI runs the full gate automatically
