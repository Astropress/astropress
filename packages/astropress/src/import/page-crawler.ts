import sanitizeHtml from "sanitize-html";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrowserCrawlOptions = {
  siteUrl: string;
  maxPages?: number;
  timeoutMs?: number;
};

export type CrawledPage = {
  url: string;
  title: string;
  body: string;
  slug: string;
  fetchedAt: string;
};

export type CrawlOptions = {
  siteUrl: string;
  startPaths?: string[];
  maxPages?: number;
  timeoutMs?: number;
  userAgent?: string;
};

export type CrawlResult = {
  pages: CrawledPage[];
  failed: { url: string; reason: string }[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isSameOrigin(base: string, url: string): boolean {
  try {
    return new URL(base).origin === new URL(url).origin;
  } catch {
    return false;
  }
}

function slugFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "home";
  } catch {
    return "page";
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

function extractBody(html: string): string {
  // Prefer <main>, then <article>, then <body> stripped of nav/header/footer
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return cleanHtml(mainMatch[1]!);
  }

  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    return cleanHtml(articleMatch[1]!);
  }

  // Strip structural chrome from the full body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    let body = bodyMatch[1]!;
    body = body.replace(/<header[\s\S]*?<\/header>/gi, "");
    body = body.replace(/<footer[\s\S]*?<\/footer>/gi, "");
    body = body.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    return cleanHtml(body);
  }

  return cleanHtml(html);
}

function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "picture", "source"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["id", "class"],
      img: ["src", "alt", "width", "height", "loading"],
      a: ["href", "title", "rel"],
    },
  }).trim();
}

function parseSitemapUrls(xml: string, siteOrigin: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1]!.trim();
    if (isSameOrigin(siteOrigin, url)) {
      urls.push(url);
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

export async function crawlSitePages(opts: CrawlOptions): Promise<CrawlResult> {
  const {
    siteUrl,
    maxPages = 500,
    timeoutMs = 15_000,
    userAgent = "Astropress-Crawler/1.0",
  } = opts;

  const origin = new URL(siteUrl).origin;
  const fetchOpts: RequestInit = {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(timeoutMs),
  };

  const pages: CrawledPage[] = [];
  const failed: { url: string; reason: string }[] = [];
  const warnings: string[] = [];
  const visited = new Set<string>();

  // Step 1: try sitemap.xml
  let urlsToVisit: string[] = [];
  try {
    const sitemapUrl = `${origin}/sitemap.xml`;
    const sitemapRes = await fetch(sitemapUrl, fetchOpts);
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      urlsToVisit = parseSitemapUrls(xml, origin);
    } else {
      warnings.push(`No sitemap.xml found at ${sitemapUrl} (HTTP ${sitemapRes.status}) — crawling from homepage`);
      urlsToVisit = [origin + "/"];
    }
  } catch (err) {
    warnings.push(`Could not fetch sitemap.xml: ${err instanceof Error ? err.message : String(err)} — crawling from homepage`);
    urlsToVisit = [origin + "/"];
  }

  // Deduplicate
  urlsToVisit = [...new Set(urlsToVisit)];

  // Step 2: fetch each page
  for (const url of urlsToVisit) {
    if (visited.has(url)) continue;
    if (pages.length >= maxPages) break;
    visited.add(url);

    try {
      const res = await fetch(url, fetchOpts);
      if (!res.ok) {
        failed.push({ url, reason: `HTTP ${res.status}` });
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        continue; // skip non-HTML resources
      }
      const html = await res.text();
      pages.push({
        url,
        title: extractTitle(html),
        body: extractBody(html),
        slug: slugFromUrl(url),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      failed.push({
        url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { pages, failed, warnings };
}

// ---------------------------------------------------------------------------
// Browser crawler (Playwright) — handles JS-rendered pages (e.g. Wix)
// ---------------------------------------------------------------------------

/**
 * Full browser crawl using Playwright. Use this when the target site renders
 * content via JavaScript (e.g. Wix sites) that plain fetch cannot capture.
 *
 * Requires Playwright to be installed: `bunx playwright install chromium`
 */
export async function crawlSitePagesWithBrowser(
  opts: BrowserCrawlOptions,
): Promise<CrawlResult> {
  const { siteUrl, maxPages = 500, timeoutMs = 30_000 } = opts;

  // Lazy-load Playwright so it isn't required for fetch-mode crawls.
  let chromium: import("playwright").BrowserType;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    return {
      pages: [],
      failed: [{ url: siteUrl, reason: "Playwright is not installed — run: bunx playwright install chromium" }],
      warnings: ["Playwright not available; falling back is recommended"],
    };
  }

  const origin = new URL(siteUrl).origin;
  const pages: CrawledPage[] = [];
  const failed: { url: string; reason: string }[] = [];
  const warnings: string[] = [];
  const visited = new Set<string>();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Astropress-Crawler/1.0",
  });

  try {
    // Try sitemap first to get a full URL list.
    let urlsToVisit: string[] = [];
    try {
      const sitemapPage = await context.newPage();
      const resp = await sitemapPage.goto(`${origin}/sitemap.xml`, { timeout: timeoutMs });
      if (resp?.ok()) {
        const xml = await sitemapPage.content();
        urlsToVisit = parseSitemapUrls(xml, origin);
      }
      await sitemapPage.close();
    } catch {
      warnings.push("Could not fetch sitemap.xml with browser — crawling from homepage");
    }
    if (urlsToVisit.length === 0) urlsToVisit = [origin + "/"];
    urlsToVisit = [...new Set(urlsToVisit)];

    for (const url of urlsToVisit) {
      if (visited.has(url)) continue;
      if (pages.length >= maxPages) break;
      visited.add(url);

      const page = await context.newPage();
      try {
        const resp = await page.goto(url, { timeout: timeoutMs, waitUntil: "networkidle" });
        if (!resp?.ok()) {
          failed.push({ url, reason: `HTTP ${resp?.status() ?? "unknown"}` });
          continue;
        }
        const html = await page.content();
        pages.push({
          url,
          title: extractTitle(html),
          body: extractBody(html),
          slug: slugFromUrl(url),
          fetchedAt: new Date().toISOString(),
        });
      } catch (err) {
        failed.push({
          url,
          reason: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return { pages, failed, warnings };
}
