# Publishing Astropress to npm

This guide covers how to publish a new version of the `astropress` package.
Releases use [Changesets](https://github.com/changesets/changesets) for
versioning and CHANGELOG management, and the CI pipeline handles the actual
publish step via `changeset publish --provenance`.

---

## Prerequisites

- Maintainer access to the GitHub repository
- `NPM_TOKEN` secret configured in repository Settings → Secrets → Actions
  (automation token with publish permission on the `astropress` npm package)
- All CI checks green on `main`

---

## Pre-flight checks

Run these locally before starting the release process:

```sh
# 1. All Vitest tests must pass
bun run --filter astropress test

# 2. All Rust CLI tests must pass
cargo test --manifest-path crates/astropress-cli/Cargo.toml

# 3. Architectural invariants must pass (TS and Rust)
bun run audit:arch && bun run audit:arch:rust

# 4. BDD scenarios must all pass
bun run bdd:test

# 5. API reference must be up to date
bun run docs:api:check

# 6. Dependency audit must be clean
bun run audit:deps && bun run audit:security

# 7. No uncommitted changes
git status --short
```

If any check fails, fix it before proceeding.

---

## Step 1 — Create a changeset

A changeset describes what changed and bumps the version type (major/minor/patch).

```sh
bun run changeset add
```

Follow the interactive prompts:
1. Select `astropress` (space to toggle, enter to confirm)
2. Choose bump type: `patch` for bug fixes, `minor` for new features, `major`
   for breaking changes
3. Write a short summary (this becomes the CHANGELOG entry)

Commit the generated changeset file:

```sh
git add .changeset/
git commit -m "chore: add changeset for <description>"
```

---

## Step 2 — Push and let CI create the Version PR

```sh
git push origin main
```

The `release.yml` workflow (powered by `changesets/action`) automatically
opens a **"Version Packages"** pull request on GitHub. This PR:

- Bumps `packages/astropress/package.json` to the new version
- Updates `packages/astropress/CHANGELOG.md`
- Squashes any pending changesets

---

## Step 3 — Review and merge the Version PR

1. Open the pull request labeled **Version Packages** on GitHub
2. Review the CHANGELOG.md diff — verify the bump type is correct and the
   entry accurately describes the change
3. Merge the PR (squash merge is fine)

---

## Step 4 — CI publishes automatically

After the Version PR merges, `release.yml` runs the publish job:

```yaml
publish: bun run release -- --provenance
```

This calls `changeset publish --provenance`, which:

1. Runs `prepublishOnly` (`bun run build && bun run audit:arch`) to emit the compiled `.js` output into `dist/`
2. Publishes `packages/astropress` to the npm registry
3. Attaches a **SLSA Build L1 provenance attestation** — verifiable at
   npmjs.com under the package's provenance tab. See
   [npm provenance docs](https://docs.npmjs.com/generating-provenance-statements)
   for how to verify it.
4. Creates a git tag (`astropress@<version>`) and pushes it

No manual `npm publish` step is required.

---

## Step 5 — Verify the release

```sh
# Confirm the new version is visible on npm (replace X.Y.Z with the published version)
npm show astropress version

# Smoke-test the published package in a scratch directory
mkdir /tmp/ap-smoke && cd /tmp/ap-smoke
bun add astropress@latest

# ESM smoke test — should print a list of exported names
cat > smoke.mjs << 'EOF'
import * as ap from 'astropress';
console.log('ok', Object.keys(ap).slice(0, 10));
EOF
node smoke.mjs
```

Check the provenance badge on the npm package page — it should show
"Published with provenance" linking to the exact CI run that built it.

---

## Step 6 — Create a GitHub Release

1. Go to **Releases → Draft a new release** on GitHub
2. Select the tag that was auto-created (e.g. `astropress@0.1.0`)
3. Copy the relevant section from `packages/astropress/CHANGELOG.md` into the
   release notes
4. Publish the release

---

## CLI distribution

The Astropress CLI is a Rust binary distributed **separately** from the npm
package. It is not bundled in the `astropress` npm package — the `bin` field
was intentionally removed.

The CLI has two distribution channels, each with its own audience:

| Channel        | Command for users        | Audience                                  |
|----------------|--------------------------|-------------------------------------------|
| crates.io      | `cargo install astropress-cli` | Rust users; builds from source |
| GitHub Releases| Download pre-built binary| Users without a Rust toolchain            |

A full CLI release publishes to **both** channels from a single git tag
matching `cli-v*` (e.g. `cli-v0.2.0`).

---

### Publishing the CLI to crates.io

#### One-time setup (first release only)

1. **Claim the crate name.** A maintainer with a crates.io account must
   publish the initial `0.0.x` version manually so the name is reserved:

   ```sh
   cargo login                     # paste your crates.io API token
   cd crates/astropress-cli
   cargo publish --dry-run         # verify packaging is clean
   cargo publish                   # actually publish
   ```

2. **Add co-owners** so the release workflow and other maintainers can
   publish future versions:

   ```sh
   cargo owner --add github:<org>:<team> astropress-cli
   cargo owner --add <other-maintainer-handle> astropress-cli
   ```

3. **Add the API token to repository secrets.** Create a scoped token on
   [crates.io → Account Settings → API Tokens](https://crates.io/settings/tokens)
   with scope `publish-update` restricted to the `astropress-cli` crate.
   Save it as the `CARGO_REGISTRY_TOKEN` secret under
   **Settings → Secrets → Actions**.

#### Per-release workflow

1. **Bump the version** in `crates/astropress-cli/Cargo.toml`:

   ```toml
   [package]
   name = "astropress-cli"
   version = "0.2.0"   # bump per semver
   ```

2. **Run the pre-flight checks locally:**

   ```sh
   # Rust tests
   cargo test --manifest-path crates/Cargo.toml

   # Architecture invariants (LOC caps, layering)
   bun run audit:arch:rust

   # Clippy must be clean — the release build denies warnings
   cargo clippy --manifest-path crates/Cargo.toml --all-targets -- -D warnings

   # Packaging dry-run — catches missing files, path issues, license errors
   cargo publish --manifest-path crates/astropress-cli/Cargo.toml --dry-run
   ```

3. **Commit the version bump and tag:**

   ```sh
   git commit -am "chore: release astropress-cli v0.2.0"
   git tag cli-v0.2.0
   git push origin main --tags
   ```

4. **Wait for the binary-release CI.** Pushing the `cli-v*` tag triggers
   `.github/workflows/cli-release.yml`, which builds release binaries for
   every target in the matrix (`x86_64-unknown-linux-gnu`,
   `aarch64-unknown-linux-gnu`, `x86_64-apple-darwin`,
   `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`) and attaches them to
   a new GitHub Release named from the tag.

   > The current workflow **does not** publish to crates.io — that step
   > is run manually after the GitHub Release is created. See step 5.

5. **Publish to crates.io from your workstation.** Once the GitHub
   Release is live, run the cargo publish from the tagged commit:

   ```sh
   git checkout cli-v0.2.0
   cargo publish --manifest-path crates/astropress-cli/Cargo.toml
   ```

   If you'd rather automate this step, append a publish job to
   `cli-release.yml` that runs after `build`:

   ```yaml
   publish-crates-io:
     needs: build
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: dtolnay/rust-toolchain@stable
       - run: cargo publish --manifest-path crates/astropress-cli/Cargo.toml
         env:
           CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
   ```

6. **Verify the release** — see the "Verify the CLI release" section below.

---

### Verify the CLI release

```sh
# 1. crates.io registry has the new version
cargo search astropress-cli | head -1

# 2. `cargo install` fetches and builds from crates.io
cargo install astropress-cli --version 0.2.0 --locked
astropress-cli --version   # binary name is `astropress-cli`, not `astropress`

# 3. GitHub Release page lists all expected platform artifacts
gh release view cli-v0.2.0
```

---

### Cargo packaging notes

- The binary artifact produced by `cargo build --release` is named
  `astropress-cli` (derived from `[package] name` in `Cargo.toml` since
  there is no `[[bin]]` override).
- `cargo publish` uploads only the `crates/astropress-cli/` subtree.
  Embedded scaffold templates referenced via `include_dir!("../../packages/astropress/templates/…")`
  are resolved at compile time relative to the source, so they are packed
  into the uploaded crate tarball automatically.
- The crate is `license = "MIT"`. Keep the monorepo's root `LICENSE`
  present; `cargo publish` will refuse if no license file is discoverable
  for the crate.
- Versions published to crates.io are immutable. A release that must be
  withdrawn can be `cargo yank`-ed but not deleted — plan version bumps
  with that in mind.

---

### Required repository secrets (CLI)

| Secret | Purpose |
|--------|---------|
| `CARGO_REGISTRY_TOKEN` | crates.io API token scoped to `publish-update` on `astropress-cli` |

---

### Troubleshooting CLI publishing

**`cargo publish` fails with "crate X is not allowed to upload data"**
→ The crates.io token does not have `publish-update` scope for
`astropress-cli`. Regenerate the token on crates.io with the correct
scope and update the `CARGO_REGISTRY_TOKEN` secret.

**`cargo publish` fails with "crate already exists"**
→ `Cargo.toml` version was not bumped. Update it, commit, re-tag.

**CI builds pass but `cargo publish` step fails with "dirty working tree"**
→ The workflow checked out a commit but some build step modified tracked
files (e.g. `Cargo.lock`). Add `--allow-dirty` only as a last resort;
prefer committing the regenerated file to the tag.

**`cargo install astropress-cli` builds but the binary is missing**
→ The binary name is `astropress-cli` (not `astropress`). Run
`astropress-cli --help`. If a different name is desired long-term, add a
`[[bin]] name = "astropress"` section to `Cargo.toml` and bump a new
version — downstream users' shell history will need to change.

**MSRV mismatch on older toolchains**
→ `rust-version = "1.82"` is pinned in `Cargo.toml`. Users on older
toolchains see a clear error from `cargo install`; they need to run
`rustup update stable`.

---

## Required repository secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm automation token with `publish` access to the `astropress` package |

OIDC is used for provenance — no additional secret is needed beyond the
`id-token: write` permission already in `release.yml`.

---

## Troubleshooting

**"Version Packages" PR does not appear after push**
→ Check that `.changeset/config.json` lists `astropress` in the packages
(not in `ignore`) and that the changeset file was committed correctly
(`bun run changeset status`). Also verify that `GITHUB_TOKEN` has
`pull-requests: write` permission (it does by default, but org settings can
restrict it).

**Publish step fails with 403**
→ The `NPM_TOKEN` secret may be expired or have insufficient permissions.
Regenerate an automation token on npmjs.com and update the repository secret.

**`--provenance` flag not recognised**
→ npm 9.5+ is required. Bun bundles a compatible npm; verify with
`bun pm --version`. The `release.yml` job uses `oven-sh/setup-bun` which
provides a compatible version.

**`prepublishOnly` fails**
→ `prepublishOnly` runs `bun run build` then `audit:arch`. If `build` fails,
check that `tsc` can find all imports (`tsconfig.build.json` includes both
`src/**/*.ts` and `index.ts`). If `audit:arch` fails with `no-js-in-src`, a
stray `.js` file crept into `packages/astropress/src/` — delete it and let
the build re-emit into `dist/`.

**Changeset is for the wrong package**
→ Delete the changeset file from `.changeset/`, run `bun run changeset add`
again, and select only `astropress`.

**`id-token: write` permission missing**
→ If provenance signing fails, verify that `release.yml` has
`permissions: id-token: write` at the job level. This is required for the OIDC
token exchange that backs the provenance attestation.
