# Astropress CLI Specification

## Scope

This spec covers the Rust CLI crate currently located at `crates/astropress-cli`.

If Astropress later splits into multiple repositories, this file should move with the CLI repo.

## Responsibilities

The CLI is responsible for:

- project scaffolding
- local development workflow commands
- WordPress import orchestration
- deploy and sync orchestration
- packaging a non-Node-native entry point for operational workflows

The CLI is for shipping and operating Astropress sites built as relatively simple web applications for individuals and small organizations, not for exposing a generic website-builder surface.

## Required Command Surface

The CLI must support:

- `astropress new`
- `astropress dev`
- `astropress import wordpress`
- `astropress sync export`
- `astropress sync import`
- `astropress deploy`

## Delivery Model

- implementation language: Rust
- package manager/build tool: Cargo
- normal user distribution: prebuilt binaries and/or npm wrapper
- end users should not need Rust installed to use the released CLI

## Design Constraints

- commands should map to product workflows, not low-level provider internals
- provider-specific behavior should be hidden behind shared command semantics
- the CLI should stay aligned with the core package contracts rather than inventing separate concepts

## Current Runtime State

- `astropress new` should scaffold local SQLite defaults for a working non-technical admin flow
- `astropress new --provider sqlite|supabase|runway` should scaffold a matching local provider default for a working non-technical admin flow
- `astropress dev --provider sqlite|supabase|runway` should seed the packaged SQLite-backed provider runtime before launching the local site
- `astropress import wordpress`, `astropress sync export`, `astropress sync import`, and GitHub Pages deploy should invoke the packaged Astropress workflow modules instead of reimplementing those workflows directly in Rust
