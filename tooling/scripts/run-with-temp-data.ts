import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    throw new Error("usage: bun run tooling/scripts/run-with-temp-data.ts <command> [args...]");
  }

  const tempDataRoot = await mkdtemp(join(tmpdir(), "astropress-data-"));

  try {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        ASTROPRESS_DATA_ROOT: tempDataRoot,
        ASTROPRESS_LOCAL_IMAGE_ROOT: tempDataRoot,
      },
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } finally {
    await rm(tempDataRoot, { recursive: true, force: true });
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
