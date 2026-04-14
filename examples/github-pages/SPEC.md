# Astropress GitHub Pages Example Specification

## Scope

This spec covers the example/docs app currently located at `examples/github-pages`.

If Astropress later splits into separate repositories, this file should move with the example/docs repo.

## Responsibilities

The GitHub Pages example is responsible for:

- demonstrating the public-site side of Astropress
- documenting the admin and provider architecture
- showing the host runtime seam explicitly
- providing a static docs/example surface suitable for GitHub Pages
- showing the kind of relatively simple site Astropress is meant to power for individuals and small organizations

## Constraints

- the example is not the canonical production write runtime
- the example must not imply that git is the primary authoring workflow
- the example should document how database-backed Astropress deployments differ from a static docs surface
- the example must not imply that Astropress is a generic drag-and-drop website builder

## Required Demonstrations

- a public example site
- docs pointing to the org-level and repo-level specs
- a documented host runtime implementation example
- explanation of how the same content model can target GitHub Pages, Cloudflare, and Supabase
