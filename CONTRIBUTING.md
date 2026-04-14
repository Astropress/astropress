# Contributing to Astropress

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | 1.3.10 | `curl -fsSL https://bun.sh/install | bash` |
| Node.js | 24.8+ | `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash` then `nvm install 24 && nvm use 24 && nvm alias default 24` |
| Rust | 1.82+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Playwright browsers | latest | `npx playwright install --with-deps chromium` |

Alternatively, open the repo in VS Code and select **Reopen in Container** — the devcontainer handles all prerequisites automatically.

Or run the bundled installer from a local checkout, which provisions all of the above (Bun, Node 24.8+, Rust, Playwright browsers) and then runs the test suite:

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
80% branches**. The branch threshold is lower only because some branches
genuinely can't be exercised from tests (e.g. platform-specific fallbacks
behind `process.platform === "win32"`). Uncovered branches that *can* be
reached — including error paths — must be tested or removed; dead branches
are not acceptable and should be pruned, not tolerated.

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

## Build output

`tsc` emits compiled `.js` into `packages/astropress/dist/` (gitignored). The
`src/` tree is TypeScript-only — the `no-js-in-src` arch-lint rule fails the
build if a `.js` file appears there or at the package root. To produce the
published layout locally:

```bash
bun run --filter astropress build
```

This runs `tsc -p packages/astropress/tsconfig.build.json --noCheck` followed
by `tooling/scripts/add-js-ext.ts dist`, which rewrites extensionless relative
imports to `.js` so the emitted ESM works under Node. `package.json` `exports`
point consumers at `./dist/src/*.js`; the `types` condition still points at
the `.ts` source, so no `.d.ts` emission is needed.

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
- Present-tense imperative subject line (`add focus trap to confirm dialog`)
- Reference the feature file or test if the change is behaviour-driven

## Opening a pull request

1. `bun run test` — all tests pass
2. `bun run audit:arch` — no boundary violations
3. `bunx biome check packages/astropress/src` — zero lint errors
4. If the proposed code was substantially AI-generated, run a fresh evaluation pass against `docs/reference/EVALUATION.md` before submitting so the PR includes an up-to-date quality assessment.
5. Open the PR; CI runs the full gate automatically
