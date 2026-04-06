import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const mimeTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

type RouteAudit = {
  path: string;
  title: string;
  landmarkSelector?: string;
  heading?: string;
};

const auditedRoutes: RouteAudit[] = [
  { path: "/", title: "Astropress", landmarkSelector: "main", heading: "A real admin for simple sites, without inheriting all of WordPress." },
  { path: "/docs/", title: "Docs", landmarkSelector: "main", heading: "Astropress Docs" },
  { path: "/admin/", title: "Admin", landmarkSelector: "main", heading: "Admin Model" },
];

function contentTypeFor(pathname: string) {
  return mimeTypes.get(extname(pathname)) ?? "application/octet-stream";
}

function resolveRequestedPath(root: string, requestPath: string) {
  const decoded = decodeURIComponent(requestPath.split("?")[0] || "/");
  const safePath = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const filesystemPath = join(root, safePath);
  return safePath.endsWith("/") ? join(filesystemPath, "index.html") : filesystemPath;
}

async function serveStaticFile(root: string, request: IncomingMessage, response: ServerResponse) {
  const filePath = resolveRequestedPath(root, request.url || "/");
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": contentTypeFor(filePath),
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function main() {
  const distRoot = process.argv[2];
  if (!distRoot) {
    console.error("Usage: bun run scripts/accessibility-browser-audit.ts <dist-directory>");
    process.exit(1);
  }

  await access(distRoot);

  const server = createServer((request, response) => {
    void serveStaticFile(distRoot, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", () => resolve());
  });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();

    for (const route of auditedRoutes) {
      const url = `http://127.0.0.1:4173${route.path}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (!response || !response.ok()) {
        throw new Error(`Failed to load ${url}: ${response?.status() ?? "no response"}`);
      }
      const title = await page.title();
      if (!title.includes(route.title)) {
        throw new Error(`Unexpected title for ${route.path}: received "${title}"`);
      }

      if (route.landmarkSelector) {
        const landmark = page.locator(route.landmarkSelector);
        if ((await landmark.count()) === 0) {
          throw new Error(`Missing landmark "${route.landmarkSelector}" on ${route.path}`);
        }
      }

      if (route.heading) {
        const heading = page.getByRole("heading", { level: 1, name: route.heading });
        if ((await heading.count()) === 0) {
          throw new Error(`Missing expected h1 "${route.heading}" on ${route.path}`);
        }
      }

      await page.keyboard.press("Tab");
      const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      if (!activeTag) {
        throw new Error(`Keyboard focus did not move on ${route.path}`);
      }

      const accessibilityScan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .disableRules(["color-contrast"])
        .analyze();

      if (accessibilityScan.violations.length > 0) {
        const details = accessibilityScan.violations
          .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
          .join("\n");
        throw new Error(`Axe violations found on ${route.path}\n${details}`);
      }
    }

    console.log(`Browser accessibility audit passed for ${auditedRoutes.length} routes.`);
    await context.close();
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

await main();
