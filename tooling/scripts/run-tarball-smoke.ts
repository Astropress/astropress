/**
 * Publish-time tarball smoke test.
 *
 * Builds the package, packs it with npm pack, installs the tarball into a fresh
 * copy of examples/npm-consumer-smoke (no workspace symlinks), boots the dev server,
 * and asserts that every admin route returns HTTP 200.
 *
 * This is the primary guard against packaging bugs that are invisible to workspace
 * tests — e.g. bare astropress/ imports in compiled .astro pages, missing dist/
 * files, or broken package exports.
 *
 * Usage:
 *   bun run tooling/scripts/run-tarball-smoke.ts
 */

import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

import { ADMIN_SMOKE_ROUTES } from "./run-consumer-smoke.js";

type ServerHandle = { process: ChildProcess };

function spawnServer(
  name: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ServerHandle {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, ...env },
  });
  child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[${name}] ${chunk}`));
  return { process: child };
}

async function stopServer(handle: ServerHandle): Promise<void> {
  if (handle.process.exitCode !== null) return;
  const pid = handle.process.pid;
  if (pid) {
    try { process.kill(-pid, "SIGTERM"); } catch { handle.process.kill("SIGTERM"); }
  } else {
    handle.process.kill("SIGTERM");
  }
  await new Promise((r) => setTimeout(r, 500));
  if (handle.process.exitCode === null) {
    if (pid) {
      try { process.kill(-pid, "SIGKILL"); } catch { handle.process.kill("SIGKILL"); }
    } else {
      handle.process.kill("SIGKILL");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function findAvailablePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available port starting at ${preferred}`);
}

async function waitForServer(url: string, timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk; process.stderr.write(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if ((code ?? 1) !== 0) reject(new Error(`${command} ${args.join(" ")} exited with code ${code}\n${stderr}`));
      else resolve(stdout);
    });
  });
}

async function main(): Promise<void> {
  const root = process.cwd();
  const pkgDir = path.join(root, "packages/astropress");
  const smokeTemplateDir = path.join(root, "examples/npm-consumer-smoke");

  let tempProjectDir: string | null = null;
  let tempDataDir: string | null = null;
  let server: ServerHandle | null = null;

  try {
    // 1. Build the package.
    console.log("Building @astropress-diy/astropress…");
    await runCommand("bun", ["run", "build"], pkgDir);

    // 2. Pack the tarball.
    console.log("Packing tarball…");
    const packOutput = await runCommand("npm", ["pack", "--json"], pkgDir);
    const packResult = JSON.parse(packOutput.trim()) as Array<{ filename: string }>;
    const tarballName = packResult[0]?.filename;
    if (!tarballName) throw new Error("npm pack produced no output");
    const tarballPath = path.join(pkgDir, tarballName);
    console.log(`Tarball: ${tarballPath}`);

    // 3. Copy the consumer smoke template to a temp directory.
    tempProjectDir = await mkdtemp(path.join(tmpdir(), "astropress-tarball-smoke-"));
    tempDataDir = await mkdtemp(path.join(tmpdir(), "astropress-tarball-data-"));
    console.log(`Temp project: ${tempProjectDir}`);

    await cp(smokeTemplateDir, tempProjectDir, { recursive: true });

    // 4. Rewrite package.json to use the packed tarball instead of workspace:*.
    const pkgJsonPath = path.join(tempProjectDir, "package.json");
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    pkgJson.dependencies["@astropress-diy/astropress"] = `file:${tarballPath}`;
    await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");

    // 5. Install dependencies (uses the tarball, not the workspace symlink).
    console.log("Installing from tarball…");
    await runCommand("npm", ["install", "--prefer-offline"], tempProjectDir);

    // 6. Boot the dev server.
    const port = await findAvailablePort(4327);
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`Starting tarball smoke server on port ${port}…`);
    server = spawnServer(
      "tarball-smoke",
      "npx",
      ["astro", "dev", "--host", "127.0.0.1", "--port", String(port)],
      tempProjectDir,
      {
        ASTROPRESS_DATA_ROOT: tempDataDir,
        ASTROPRESS_LOCAL_IMAGE_ROOT: tempDataDir,
      },
    );

    await waitForServer(`${baseUrl}/ap-admin`);
    console.log("Tarball server ready. Running route smoke check…\n");

    // 7. Fetch every admin route and assert HTTP 200.
    const failures: string[] = [];

    for (const route of ADMIN_SMOKE_ROUTES) {
      const url = `${baseUrl}${route}`;
      try {
        // Follow redirects. Feature-gated routes redirect to /ap-admin; final status must be 200.
        const res = await fetch(url);
        if (res.status === 200) {
          console.log(`  ✓ ${route}`);
        } else {
          console.error(`  ✗ ${route}  →  HTTP ${res.status}`);
          failures.push(`${route}: HTTP ${res.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${route}  →  ${msg}`);
        failures.push(`${route}: ${msg}`);
      }
    }

    console.log("");

    if (failures.length > 0) {
      console.error(`tarball-smoke failed — ${failures.length} route(s) did not return HTTP 200:\n`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }

    console.log(`tarball-smoke passed — all ${ADMIN_SMOKE_ROUTES.length} routes returned HTTP 200 from the packed tarball.`);
  } finally {
    if (server) await stopServer(server);
    if (tempProjectDir) await rm(tempProjectDir, { recursive: true, force: true });
    if (tempDataDir) await rm(tempDataDir, { recursive: true, force: true });
  }
}

await main();
