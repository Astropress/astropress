#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageDir, "..", "..", "..");
const cliManifest = path.join(repoRoot, "crates", "astropress-cli", "Cargo.toml");
const cargoAvailable = spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0;
const explicitBinary = process.env.ASTROPRESS_CLI_BIN;

if (explicitBinary) {
  const result = spawnSync(explicitBinary, process.argv.slice(2), { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (!existsSync(cliManifest)) {
  console.error("Astropress CLI crate was not found. Expected:", cliManifest);
  process.exit(1);
}

if (!cargoAvailable) {
  console.error("Cargo is not installed. Install Rust or point ASTROPRESS_CLI_BIN at a prebuilt astropress binary.");
  process.exit(1);
}

const result = spawnSync(
  "cargo",
  ["run", "--manifest-path", cliManifest, "--", ...process.argv.slice(2)],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
