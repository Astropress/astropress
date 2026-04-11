# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).

## Release workflow

1. When you make a change that should be released, run:
   ```sh
   bun changeset
   ```
   Select the bump type (major / minor / patch) and write a short summary.

2. A `.md` file is added to this directory. Commit it with your PR.

3. When the PR merges to `main`, run:
   ```sh
   bun run version   # bumps package.json + updates CHANGELOG.md
   bun run release   # publishes to npm
   ```

## Bump type guide

| Change | Bump |
|--------|------|
| Breaking API change | major |
| New feature, backwards-compatible | minor |
| Bug fix or internal refactor | patch |

See [the Changesets docs](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) for more detail.
