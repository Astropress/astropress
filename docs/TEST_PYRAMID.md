# Astropress Test Pyramid

This repo uses a Percival-style outside-in test pyramid.

## Layers

1. Acceptance
   - executable BDD scenarios for admin workflows, imports, and deployments
   - representative end-to-end browser coverage for the non-technical editing path
2. Integration
   - provider adapters
   - repository/store contracts
   - import pipelines
   - deploy workflows
3. Unit
   - schema validation
   - mapping logic
   - sanitization
   - capability normalization

## Ordering

1. Write feature files.
2. Add failing acceptance or integration tests for the slice.
3. Add lower-level tests only where they help drive implementation.
4. Implement the smallest change to pass.
5. Re-run acceptance before moving to the next slice.

## Feature Wiring

- Feature files live in `features/`.
- `bun run bdd:lint` validates feature-file structure.
- `bun run bdd:test` executes the feature inventory through mapped Vitest, CLI, and Playwright verification groups.
- Root `bun run test` now runs both `bdd:lint` and `bdd:test` before the package-level test suite.
- When implementation slices change the public project contract, update the relevant feature file and the matching `scripts/bdd-test.ts` verification mapping before closing the slice.

## Coverage Gates

- `bun run test:coverage` runs V8 coverage for the package-owned test suite.
- Current enforced thresholds:
  - `85%` lines
  - `80%` functions
  - `85%` statements
  - `70%` branches
- The browser acceptance layer is tracked separately through Playwright and axe rather than folded into Vitest percentages.
- The coverage gate is scoped to the refactor-sensitive package contract/security modules and excludes large runtime paths that are currently protected by integration and browser acceptance instead of line coverage.

## Current priorities

- provider-neutral adapter contracts
- full-admin content editing
- WordPress full-editorial import
- git export/import safety
- Fleet consumer verification
