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
- `bun run bdd:lint` validates feature-file structure and runs as part of the root `bun run test`.
- When implementation slices change the public project contract, add or update the relevant feature file before closing the slice.

## Current priorities

- provider-neutral adapter contracts
- full-admin content editing
- WordPress full-editorial import
- git export/import safety
- Fleet consumer verification
