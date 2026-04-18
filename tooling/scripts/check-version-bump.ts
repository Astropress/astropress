#!/usr/bin/env bun
/**
 * check-version-bump.ts
 * Verifies that CHANGELOG.md was updated when package.json version changes
 * relative to the base branch (main). Used in CI to enforce semantic versioning
 * discipline — every version bump must be accompanied by a changelog entry.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const PKG_PATH = resolve(ROOT, "packages/astropress/package.json");
const CHANGELOG_PATH = resolve(ROOT, "packages/astropress/CHANGELOG.md");
const BASE_BRANCH = process.env.BASE_BRANCH ?? "main";

function getFileAtRef(ref: string, filePath: string): string | null {
  try {
    const relPath = filePath.replace(ROOT + "/", "");
    return execSync(`git show ${ref}:${relPath}`, { cwd: ROOT }).toString();
  } catch {
    return null;
  }
}

function getVersion(pkgContent: string): string {
  return JSON.parse(pkgContent).version as string;
}

// Read current state
const currentPkg = readFileSync(PKG_PATH, "utf-8");
const currentVersion = getVersion(currentPkg);

// Read base branch state
const basePkg = getFileAtRef(`origin/${BASE_BRANCH}`, PKG_PATH);
if (!basePkg) {
  // Can't compare — likely a new branch without remote tracking; skip check
  console.log(`✓ check:version — cannot compare to origin/${BASE_BRANCH}, skipping`);
  process.exit(0);
}

const baseVersion = getVersion(basePkg);

if (currentVersion === baseVersion) {
  console.log(`✓ check:version — version unchanged (${currentVersion})`);
  process.exit(0);
}

// Version changed — verify CHANGELOG.md mentions the new version
if (!existsSync(CHANGELOG_PATH)) {
  console.error(`✗ check:version — package version changed ${baseVersion} → ${currentVersion} but CHANGELOG.md does not exist`);
  process.exit(1);
}

const changelog = readFileSync(CHANGELOG_PATH, "utf-8");
if (!changelog.includes(currentVersion)) {
  console.error(
    `✗ check:version — package version changed ${baseVersion} → ${currentVersion} ` +
    `but CHANGELOG.md does not mention ${currentVersion}. ` +
    `Run 'bun run version' (changesets) to update the changelog before bumping the version.`
  );
  process.exit(1);
}

console.log(`✓ check:version — version ${currentVersion} documented in CHANGELOG.md`);

// Verify Cargo.toml is in sync with the npm package version
const CARGO_PATH = resolve(ROOT, "crates/astropress-cli/Cargo.toml");
if (existsSync(CARGO_PATH)) {
  const cargoToml = readFileSync(CARGO_PATH, "utf-8");
  const cargoMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  const cargoVersion = cargoMatch?.[1];
  if (cargoVersion && cargoVersion !== currentVersion) {
    console.error(
      `✗ check:version — Cargo.toml version (${cargoVersion}) does not match package.json (${currentVersion}). ` +
      `Run 'bun run version' to sync.`
    );
    process.exit(1);
  }
  console.log(`✓ check:version — Cargo.toml version in sync (${cargoVersion})`);
}
