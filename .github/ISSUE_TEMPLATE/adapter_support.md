---
name: Adapter support request
about: Request support for a new database, storage, or hosting provider
title: "[Adapter] "
labels: adapter
assignees: ""
---

## Provider details

| Field | Value |
|-------|-------|
| Provider name | <!-- e.g. PlanetScale, Turso, Neon --> |
| Provider type | <!-- database / object-storage / hosting --> |
| Official Node/Edge SDK | <!-- link to npm package --> |

## Why this provider?

Who uses it and why is it a good fit for Astropress sites?

## Proposed adapter interface

Which methods of `AstropressPlatformAdapter` need non-trivial implementations for this provider?

- [ ] `getContentOverridesDb()`
- [ ] `storeMediaObject()`
- [ ] `deleteMediaObject()`
- [ ] Other: ___

## Can you help implement it?

- [ ] Yes — I can submit a PR
- [ ] Partial — I can help test but need implementation guidance
- [ ] No — I need someone else to implement it
