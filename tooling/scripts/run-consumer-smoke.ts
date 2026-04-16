/**
 * Consumer smoke test runner.
 *
 * Boots examples/npm-consumer-smoke (workspace:* but WITHOUT monorepo source aliases)
 * and fetches every admin route, asserting HTTP 200. This catches 500 errors that
 * would affect npm consumers but are invisible to the workspace-aliased admin-harness.
 *
 * Usage:
 *   bun run tooling/scripts/run-consumer-smoke.ts [--skip-build]
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

// All static admin routes + representative dynamic routes using seeded data.
// Keep this list in sync with audit-admin-route-coverage.ts.
//
// Notes on routing:
// - Feature-gated routes (cms, fundraising, host) redirect to /ap-admin when not
//   configured; the smoke test follows redirects, so their final status is 200.
// - /ap-admin/subscribers and /ap-admin/import are permanent redirects (301) to
//   /ap-admin/settings; covered implicitly via the settings entry.
export const ADMIN_SMOKE_ROUTES = [
  "/ap-admin",
  "/ap-admin/posts",
  "/ap-admin/posts/new",
  "/ap-admin/posts/hello-world",
  "/ap-admin/posts/hello-world/revisions",
  "/ap-admin/pages",
  "/ap-admin/pages/new",
  "/ap-admin/comments",
  "/ap-admin/redirects",
  "/ap-admin/users",
  "/ap-admin/media",
  "/ap-admin/archives",
  "/ap-admin/authors",
  "/ap-admin/taxonomies",
  "/ap-admin/seo",
  "/ap-admin/settings",
  "/ap-admin/services",
  "/ap-admin/system",
  "/ap-admin/api-tokens",
  "/ap-admin/translations",
  "/ap-admin/route-pages",
  "/ap-admin/webhooks",
  "/ap-admin/cms",
  "/ap-admin/host",
  "/ap-admin/testimonials",
  // Omitted: /ap-admin/fundraising (requires donations config + auth to avoid 404),
  // /ap-admin/subscribers and /ap-admin/import (301 redirects that require auth middleware).
  // These are covered by the admin-harness Playwright specs which have full middleware context.
  "/ap-admin/login",
  "/ap-admin/reset-password",
  "/ap-admin/accept-invite?token=demo",
] as const;

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

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
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

async function runCommand(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (c) => resolve(c ?? 1));
  });
  if (code !== 0) throw new Error(`${command} ${args.join(" ")} exited with code ${code}`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const skipBuild = process.argv.includes("--skip-build");
  const dataRoot = await mkdtemp(path.join(tmpdir(), "astropress-consumer-smoke-"));
  let server: ServerHandle | null = null;

  try {
    if (!skipBuild) {
      console.log("Building @astropress-diy/astropress…");
      await runCommand("bun", ["run", "--filter", "@astropress-diy/astropress", "build"], root);
    }

    const port = await findAvailablePort(4326);
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`Starting npm-consumer-smoke dev server on port ${port}…`);
    server = spawnServer(
      "consumer-smoke",
      "bun",
      ["run", "--filter", "astropress-example-npm-consumer-smoke", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
      root,
      {
        ASTROPRESS_DATA_ROOT: dataRoot,
        ASTROPRESS_LOCAL_IMAGE_ROOT: dataRoot,
      },
    );

    await waitForServer(`${baseUrl}/ap-admin`);
    console.log("Server ready. Running route smoke check…\n");

    const failures: string[] = [];

    for (const route of ADMIN_SMOKE_ROUTES) {
      const url = `${baseUrl}${route}`;
      try {
        // Follow redirects (default). Feature-gated routes redirect to /ap-admin;
        // the final response must be 200. 5xx or network errors are failures.
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
      console.error(`consumer-smoke failed — ${failures.length} route(s) did not return HTTP 200:\n`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }

    console.log(`consumer-smoke passed — all ${ADMIN_SMOKE_ROUTES.length} routes returned HTTP 200.`);
  } finally {
    if (server) await stopServer(server);
    await rm(dataRoot, { recursive: true, force: true });
  }
}

await main();
