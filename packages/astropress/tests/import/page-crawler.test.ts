import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlSitePages } from "../../src/import/page-crawler.js";

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mysite.com/about</loc></url>
  <url><loc>https://mysite.com/contact</loc></url>
</urlset>`;

const ABOUT_HTML = `<!DOCTYPE html>
<html>
<head><title>About Us</title></head>
<body>
  <header><nav>Home | About</nav></header>
  <main><h1>About Us</h1><p>We build great things.</p></main>
  <footer>© 2024</footer>
</body>
</html>`;

const CONTACT_HTML = `<!DOCTYPE html>
<html>
<head><title>Contact</title></head>
<body>
  <header><nav>Home | Contact</nav></header>
  <article><h1>Get in touch</h1><p>Email us at hello@example.com</p></article>
  <footer>© 2024</footer>
</body>
</html>`;

function makeResponse(body: string, status = 200, contentType = "text/html") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("crawlSitePages — sitemap-based crawl", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("discovers pages from sitemap.xml and fetches each", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]!.url).toBe("https://mysite.com/about");
    expect(result.pages[0]!.title).toBe("About Us");
    expect(result.pages[1]!.url).toBe("https://mysite.com/contact");
    expect(result.pages[1]!.title).toBe("Contact");
  });

  it("extracts content from <main> element, stripping header/footer/nav", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages[0]!.body).toContain("We build great things");
    expect(result.pages[0]!.body).not.toContain("Home | About");
    expect(result.pages[0]!.body).not.toContain("© 2024");
  });

  it("extracts content from <article> when no <main> is present", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages[1]!.body).toContain("Email us at hello@example.com");
    expect(result.pages[1]!.body).not.toContain("Home | Contact");
  });

  it("derives a slug from each page URL", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages[0]!.slug).toBe("about");
    expect(result.pages[1]!.slug).toBe("contact");
  });
});

describe("crawlSitePages — sitemap fallback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("falls back to crawling the homepage when no sitemap exists", async () => {
    const homepageHtml = `<html>
<head><title>Home</title></head>
<body>
  <main><p>Welcome</p></main>
</body>
</html>`;

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse("", 404))       // sitemap 404
      .mockResolvedValueOnce(makeResponse(homepageHtml)); // homepage

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.title).toBe("Home");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("No sitemap.xml found")]),
    );
  });
});

describe("crawlSitePages — failure modes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("records 404 pages as failed without throwing", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse("Not Found", 404))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.url).toBe("https://mysite.com/about");
    expect(result.failed[0]!.reason).toContain("404");
  });

  it("records network-level errors per-page without throwing", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockRejectedValueOnce(new TypeError("fetch failed: ECONNREFUSED"))
      .mockResolvedValueOnce(makeResponse(CONTACT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages).toHaveLength(1);
    expect(result.failed[0]!.reason).toContain("ECONNREFUSED");
  });

  it("respects maxPages and stops after the limit", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com", maxPages: 1 });

    expect(result.pages).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2); // sitemap + 1 page
  });

  it("deduplicates URLs so the same page is not fetched twice", async () => {
    const sitemapWithDupe = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mysite.com/about</loc></url>
  <url><loc>https://mysite.com/about</loc></url>
</urlset>`;

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(sitemapWithDupe, 200, "application/xml"))
      .mockResolvedValueOnce(makeResponse(ABOUT_HTML));

    const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

    expect(result.pages).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2); // sitemap + 1 unique page
  });
});
