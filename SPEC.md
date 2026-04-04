# Astropress Production Specification

## Product

Astropress is a low-carbon WordPress replacement for individuals and small organizations that need:

- a non-technical admin panel for editing all site content
- migration from WordPress without bespoke engineering
- deployment portability across static, edge, managed database, and application-platform providers
- a lower operational footprint than a traditional always-on PHP/WordPress stack

## Canonical Data Model

The canonical source of truth is a database-backed CMS, not git.

Required canonical entities:

- pages
- posts
- media
- redirects
- comments
- users
- roles
- revisions
- translations
- site settings

Git is a secondary synchronization substrate used for:

- static-host deployment inputs
- backup and disaster recovery
- code review of content snapshots
- migration handoff artifacts

## Provider Model

Astropress must treat providers as interchangeable adapters behind stable contracts.

Required first-party adapters in v1:

- GitHub Pages
- Cloudflare
- Supabase
- Runway

Rules:

- admin behavior may not fork by provider in templates
- provider differences must stay inside adapter implementations
- any provider with a database and object-store equivalent should be addable without redesigning the CMS core

## Admin Contract

The admin panel is for non-technical users.

Therefore:

- every editable content surface must be manageable in the admin panel
- git knowledge may not be required for publishing or editing
- previews, revisions, media workflows, redirects, and localization must have admin flows
- provider-specific credentials and deploy actions must be abstracted into task-oriented UI and CLI commands

## CLI Contract

The CLI is authored as a Cargo crate and exposed through the npm package wrapper.

Required v1 commands:

- `astropress new`
- `astropress dev`
- `astropress import wordpress`
- `astropress sync export`
- `astropress sync import`
- `astropress deploy`

WordPress import v1 scope:

- pages and posts
- media
- redirects/permalinks
- comments
- authors/users where importable
- revision/history metadata where available

## Example and Docs

GitHub Pages is required for the public example/docs surface.

It is not the sole production runtime for write operations.

The example must demonstrate:

- a static public site
- admin architecture and workflow documentation
- how the same content model can deploy to GitHub Pages, Cloudflare, Supabase, or Runway
