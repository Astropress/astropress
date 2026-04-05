# Local Split Map

The Astropress codebase is now prepared locally as four sibling repositories under `/home/user/code`:

- `astropress`
  - docs, examples, and org-level product guidance
- `astropress-js`
  - the published npm package, provider adapters, admin app, tests, features, and workflow modules
- `astropress-cli`
  - the Cargo CLI implementation
- `astropress-github`
  - shared GitHub organization profile and issue-template defaults

## Verification Status

- `astropress-js`: `bun run test`
- `astropress-cli`: `cargo test`
- `astropress` example/docs app:
  - `bun install --force`
  - `bun run test:example`
- Fleet consumer verification against the standalone `astropress-js` repo:
  - `bun install --force`
  - `bun run check`
  - `bun run test`
  - `bun run build:cloudflare-production`
  - `bun run test:e2e:public`
  - `bun run test:e2e:admin`

## Notes

- The current `astropress` repo remains the best local stand-in for the future docs/site repo.
- The sibling repos are local-only preparation; they have no remotes configured yet.
- The split repos use repo-local git identity and can be pushed once remotes exist.
- Fleet no longer points at `astropress/packages/astropress`; it consumes the sibling `astropress-js` repo directly.
