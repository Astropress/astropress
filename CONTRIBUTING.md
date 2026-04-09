# Contributing to Astropress

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | 1.3.10 | `curl -fsSL https://bun.sh/install | bash` |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.82+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Playwright browsers | latest | `npx playwright install --with-deps chromium` |

Alternatively, open the repo in VS Code and select **Reopen in Container** — the devcontainer handles all prerequisites automatically.

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

## The dual `.ts` / `.js` file pattern

Most source files in `packages/astropress/src/` appear in pairs:

- `foo.ts` — TypeScript source (typed development, test suite, type checking)
- `foo.js` — pre-compiled JavaScript (what consumers without a TypeScript build step import)

**The `.js` files are not generated.** They are committed alongside the `.ts` files and must be kept in sync manually. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#the-dual-ts--js-file-pattern) for why.

**The rule:** whenever you edit a `.ts` file that has a `.js` sibling, you must also update the `.js` file to match. The `audit:sync` script catches export-level divergence:

```bash
bun run audit:sync
```

If you add a new exported symbol to a `.ts` file and forget the `.js`, CI will fail.

Files that are `.ts`-only (no `.js` sibling) do not need this treatment — they are consumed exclusively through the TypeScript compiler path.

## Architecture boundaries

The `audit:arch` script enforces cross-project import rules. Run it before opening a PR:

```bash
bun run audit:arch
```

Never import host-app paths directly from `packages/astropress/`. All runtime dependencies must go through the `"local-runtime-modules"` Vite alias seam.

## BDD feature files

Acceptance behaviour is documented in `features/`. Before opening a PR that changes user-visible behaviour, add or update a scenario:

```gherkin
# features/content/posts.feature
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
