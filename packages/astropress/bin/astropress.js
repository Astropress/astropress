#!/usr/bin/env node
/**
 * Astropress CLI stub.
 *
 * The CLI is a Rust binary distributed separately from the npm package.
 * Install it via:
 *
 *   cargo install astropress-cli
 *
 * Or download a prebuilt binary from:
 *   https://github.com/astropress/astropress/releases
 *
 * If you have a prebuilt binary you can point directly to it:
 *   ASTROPRESS_CLI_BIN=/path/to/astropress npx astropress <command>
 */

import { spawnSync } from "node:child_process";

const explicitBinary = process.env.ASTROPRESS_CLI_BIN;
if (explicitBinary) {
  const result = spawnSync(explicitBinary, process.argv.slice(2), { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

console.error(
  "astropress: CLI not found.\n\n" +
  "The Astropress CLI is a Rust binary installed separately from the npm package.\n\n" +
  "  cargo install astropress-cli\n\n" +
  "Or download a prebuilt binary from:\n" +
  "  https://github.com/astropress/astropress/releases\n\n" +
  "To use a custom binary path:\n" +
  "  ASTROPRESS_CLI_BIN=/path/to/astropress npx astropress <command>"
);
process.exit(1);
