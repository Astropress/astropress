---
"@astropress-diy/astropress": patch
---

Publish the work merged since 0.0.3 so consumers can pin a released version.

The 0.0.3 artifact on npm dates from 2026-04-15 and its changelog entry
describes a publish-pipeline test. Since then 33 commits have touched this
package without a changeset, so no version was ever cut and the published
artifact no longer matches the source at the same version number.

Two gaps make it unusable for a site that consumes the public-site
integration: `./integration` does not re-export
`createAstropressPublicSiteIntegration`, and no published export path
reaches `createAstropressViteIntegration`. The published export map also
lacks `./components/*.astro`, which the export map in `main` provides.

Bump type is patch to avoid asserting a versioning policy; minor is
defensible, since released export paths are added.
