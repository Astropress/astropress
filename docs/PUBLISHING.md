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

# 3. TS/JS companion files must be in sync
bun run audit:sync

# 4. Architectural invariants must pass
bun run audit:arch

# 5. BDD scenarios must all pass
bun run bdd:test

# 6. No uncommitted changes
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

1. Publishes `packages/astropress` to the npm registry
2. Attaches a **SLSA Build L1 provenance attestation** via npm's OIDC
   integration — verifiable at npmjs.com under the package's provenance tab
3. Creates a git tag (`astropress@<version>`) and pushes it

No manual `npm publish` step is required.

---

## Step 5 — Verify the release

```sh
# Confirm the new version is visible on npm
# (replace X.Y.Z with the published version)
npm show astropress version

# Smoke-test the published package in a scratch directory
mkdir /tmp/ap-smoke && cd /tmp/ap-smoke
bun add astropress@latest
node -e "const ap = require('astropress'); console.log('ok', typeof ap)"
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

## Required repository secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm automation token with `publish` access to the `astropress` package |

OIDC is used for provenance — no additional secret is needed beyond the
`id-token: write` permission already in `release.yml`.

---

## Troubleshooting

**"Version Packages" PR does not appear after push**
→ Check that `.changeset/config.json` lists `astropress` and that the
changeset file was committed correctly (`bun run changeset status`).

**Publish step fails with 403**
→ The `NPM_TOKEN` secret may be expired or have insufficient permissions.
Regenerate an automation token on npmjs.com and update the repository secret.

**`--provenance` flag not recognized**
→ npm 9.5+ is required. Bun bundles a compatible npm; verify with
`bun pm --version`.

**Changeset is for the wrong package**
→ Delete the changeset file from `.changeset/`, run `bun run changeset add`
again, and select only `astropress`.
