#!/usr/bin/env bun
/**
 * sync-cargo-version.ts
 *
 * Keeps the Rust CLI crate version in sync with the main npm package version.
 * Runs automatically after `changeset version` via the root `version` script,
 * so the version PR created by CI includes the Cargo.toml bump alongside the
 * package.json bump.
 *
 * Usage:
 *   bun run tooling/scripts/sync-cargo-version.ts          # sync and write
 *   bun run tooling/scripts/sync-cargo-version.ts --check   # verify in sync (CI)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const PKG_PATH = resolve(ROOT, "packages/astropress/package.json");
const CARGO_PATH = resolve(ROOT, "crates/astropress-cli/Cargo.toml");

const checkOnly = process.argv.includes("--check");

const npmVersion: string = JSON.parse(readFileSync(PKG_PATH, "utf-8")).version;
const cargoToml = readFileSync(CARGO_PATH, "utf-8");

const versionRe = /^version\s*=\s*"([^"]+)"/m;
const match = cargoToml.match(versionRe);
if (!match) {
  console.error("Could not find version field in Cargo.toml");
  process.exit(1);
}

const cargoVersion = match[1];

if (cargoVersion === npmVersion) {
  console.log(`sync-cargo-version: already in sync (${npmVersion})`);
  process.exit(0);
}

if (checkOnly) {
  console.error(
    `sync-cargo-version: version mismatch — npm is ${npmVersion}, Cargo.toml is ${cargoVersion}. ` +
    `Run 'bun run version' to sync.`,
  );
  process.exit(1);
}

const updated = cargoToml.replace(versionRe, `version = "${npmVersion}"`);
writeFileSync(CARGO_PATH, updated);
console.log(`sync-cargo-version: ${cargoVersion} -> ${npmVersion}`);
