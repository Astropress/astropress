import { spawn } from "node:child_process";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

type RouteAudit = {
  path: string;
  heading: string;
};

const auditedRoutes: RouteAudit[] = [
  { path: "/wp-admin", heading: "Dashboard" },
  { path: "/wp-admin/posts", heading: "Posts" },
  { path: "/wp-admin/posts/hello-world", heading: "Edit Post" },
  { path: "/wp-admin/comments", heading: "Comments" },
  { path: "/wp-admin/redirects", heading: "Redirects" },
  { path: "/wp-admin/login", heading: "Admin Login" },
  { path: "/wp-admin/reset-password", heading: "Reset password" },
  { path: "/wp-admin/accept-invite?token=demo", heading: "Accept invitation" },
];

async function waitForServer(url: string, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDevServerUrl(
  getOutput: () => string,
  timeoutMs = 30_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = getOutput().match(/http:\/\/127\.0\.0\.1:(\d+)\//);
    if (match) {
      return `http://127.0.0.1:${match[1]}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Timed out waiting for Astro dev server URL");
}

async function main() {
  const root = process.cwd();
  const harnessRoot = path.join(root, "examples/admin-harness");
  const devServer = spawn(
    "bun",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4325"],
    {
      cwd: harnessRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PLAYWRIGHT_E2E_MODE: "admin-harness",
      },
    },
  );

  let serverOutput = "";
  devServer.stdout.on("data", (chunk) => {
    serverOutput += String(chunk);
  });
  devServer.stderr.on("data", (chunk) => {
    serverOutput += String(chunk);
  });

  try {
    const baseUrl = await waitForDevServerUrl(() => serverOutput);
    await waitForServer(`${baseUrl}/`);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 960 },
      });
      const page = await context.newPage();

      for (const route of auditedRoutes) {
        const targetUrl = `${baseUrl}${route.path}`;
        const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
        if (!response || !response.ok()) {
          throw new Error(`Failed to load ${targetUrl}: ${response?.status() ?? "no response"}`);
        }

        const heading = page.getByRole("heading", { level: 1, name: route.heading });
        if ((await heading.count()) === 0) {
          throw new Error(`Missing expected h1 "${route.heading}" on ${route.path}`);
        }

        await page.keyboard.press("Tab");
        const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
        if (!activeTag) {
          throw new Error(`Keyboard focus did not move on ${route.path}`);
        }

        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .disableRules(["color-contrast"])
          .analyze();

        if (axe.violations.length > 0) {
          const details = axe.violations
            .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
            .join("\n");
          throw new Error(`Axe violations found on ${route.path}\n${details}`);
        }
      }

      console.log(`Admin harness browser audit passed for ${auditedRoutes.length} routes.`);
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    devServer.kill("SIGTERM");
    await new Promise((resolve) => devServer.once("exit", resolve));
    if (serverOutput.includes("error")) {
      // Keep server logs available on failures without making successful runs noisy.
      process.stderr.write(serverOutput);
    }
  }
}

await main();
