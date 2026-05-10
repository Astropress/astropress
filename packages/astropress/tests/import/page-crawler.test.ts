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
		expect(result.pages[0]?.url).toBe("https://mysite.com/about");
		expect(result.pages[0]?.title).toBe("About Us");
		expect(result.pages[1]?.url).toBe("https://mysite.com/contact");
		expect(result.pages[1]?.title).toBe("Contact");
	});

	it("extracts content from <main> element, stripping header/footer/nav", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(ABOUT_HTML))
			.mockResolvedValueOnce(makeResponse(CONTACT_HTML));

		const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

		expect(result.pages[0]?.body).toContain("We build great things");
		expect(result.pages[0]?.body).not.toContain("Home | About");
		expect(result.pages[0]?.body).not.toContain("© 2024");
	});

	it("extracts content from <article> when no <main> is present", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(ABOUT_HTML))
			.mockResolvedValueOnce(makeResponse(CONTACT_HTML));

		const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

		expect(result.pages[1]?.body).toContain("Email us at hello@example.com");
		expect(result.pages[1]?.body).not.toContain("Home | Contact");
	});

	it("derives a slug from each page URL", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(ABOUT_HTML))
			.mockResolvedValueOnce(makeResponse(CONTACT_HTML));

		const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

		expect(result.pages[0]?.slug).toBe("about");
		expect(result.pages[1]?.slug).toBe("contact");
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
			.mockResolvedValueOnce(makeResponse("", 404)) // sitemap 404
			.mockResolvedValueOnce(makeResponse(homepageHtml)); // homepage

		const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

		expect(result.pages).toHaveLength(1);
		expect(result.pages[0]?.title).toBe("Home");
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
		expect(result.failed[0]?.url).toBe("https://mysite.com/about");
		expect(result.failed[0]?.reason).toContain("404");
	});

	it("records network-level errors per-page without throwing", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
			.mockRejectedValueOnce(new TypeError("fetch failed: ECONNREFUSED"))
			.mockResolvedValueOnce(makeResponse(CONTACT_HTML));

		const result = await crawlSitePages({ siteUrl: "https://mysite.com" });

		expect(result.pages).toHaveLength(1);
		expect(result.failed[0]?.reason).toContain("ECONNREFUSED");
	});

	it("respects maxPages and stops after the limit", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(SITEMAP_XML, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(ABOUT_HTML));

		const result = await crawlSitePages({
			siteUrl: "https://mysite.com",
			maxPages: 1,
		});

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

// ---------------------------------------------------------------------------
// Slug derivation, title extraction, body fallback chain, and sitemap parsing —
// exercised through crawlSitePages because the helper functions are private.
// ---------------------------------------------------------------------------

describe("crawlSitePages — slug derivation", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("uses 'home' for the root URL where the path has no segments", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/</loc></url></urlset>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>Root</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.slug).toBe("home");
	});

	it("uses the last path segment for nested URLs (filters empty trailing-slash segments)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/blog/post-name/</loc></url></urlset>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>Body</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.slug).toBe("post-name");
	});
});

describe("crawlSitePages — title extraction", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("trims surrounding whitespace from the title text", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><head><title>   Spaced Title   </title></head><body><main>B</main></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.title).toBe("Spaced Title");
	});

	it("matches the title tag even when it carries attributes (e.g. lang)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><head><title lang="en">Hello</title></head><body><main>B</main></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.title).toBe("Hello");
	});

	it("returns empty string when no <title> tag is present (no throw on optional chain) and the page is still recorded as success", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><body><main>No title here</main></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages).toHaveLength(1);
		expect(result.failed).toEqual([]);
		expect(result.pages[0]?.title).toBe("");
	});
});

describe("crawlSitePages — body fallback chain (main → article → body-stripped)", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("uses <main class=...> when present even if an <article> also exists", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><body><main class="content"><p>main wins line 1</p>
<p>main wins line 2</p></main><article><p>not used</p></article></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.body).toContain("main wins line 1");
		expect(result.pages[0]?.body).toContain("main wins line 2");
		expect(result.pages[0]?.body).not.toContain("not used");
	});

	it("falls through to <article class=...> when no <main> is present (preserves multi-line article content; strips the wrapper)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><body><article class="post"><p>article wins line 1</p>
<p>article wins line 2</p></article></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		const body = result.pages[0]?.body ?? "";
		expect(body).toContain("article wins line 1");
		expect(body).toContain("article wins line 2");
		// The article path extracts only the inner content; the body-fallback path would
		// keep the <article> wrapper (sanitize-html keeps it by default), so this assertion
		// discriminates between "took the article branch" and "fell through to body".
		expect(body).not.toMatch(/<article[ >]/);
	});

	it("returns cleanHtml of the full input when there is no <main>, <article>, or <body> tag (final fallback path)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<p>standalone-paragraph</p>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages).toHaveLength(1);
		expect(result.pages[0]?.body).toContain("standalone-paragraph");
		expect(result.failed).toEqual([]);
	});

	it("trims leading and trailing whitespace from the sanitised body output", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		// Whitespace inside <main> would remain after sanitize-html alone; cleanHtml
		// applies an explicit `.trim()` after sanitisation. A MethodExpression mutant
		// that drops the trailing `.trim()` would leave the leading/trailing spaces
		// and newlines in the output.
		const html = `<html><body><main>   \n   <p>trimmed-body</p>   \n   </main></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		const body = result.pages[0]?.body ?? "<missing>";
		expect(body.startsWith("<")).toBe(true);
		expect(body.endsWith(">")).toBe(true);
		expect(/^\s/.test(body)).toBe(false);
		expect(/\s$/.test(body)).toBe(false);
	});

	it("falls through to <body class=...> with header/footer/nav stripped — content includes whitespace inside the wrappers", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		// header/nav/footer ARE in sanitize-html's default allowedTags, so the explicit
		// regex strip is what removes them. Whitespace inside each wrapper kills regex
		// mutants that replace `[\s\S]*?` with `[\S\S]*?` (non-whitespace only) — the
		// mutated regex fails to span the multi-line content, leaves the wrapper +
		// text intact, and the inner FOO_TEXT survives into the output.
		const html = `<html><body class="layout"><header>
\t<h1>HEADER_TEXT</h1>
</header>
<nav>
\t<a href="/x">NAV_TEXT</a>
</nav>
<p>body content line 1</p>
<p>body content line 2</p>
<footer>
\t<p>FOOTER_TEXT</p>
</footer></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		const body = result.pages[0]?.body ?? "";
		expect(body).toContain("body content line 1");
		expect(body).toContain("body content line 2");
		expect(body).not.toContain("HEADER_TEXT");
		expect(body).not.toContain("NAV_TEXT");
		expect(body).not.toContain("FOOTER_TEXT");
		// The replacement target on the strip regexes is the empty string. A
		// StringLiteral mutant turning that into "Stryker was here!" would inject
		// the marker text into the body where the wrapper was removed.
		expect(body).not.toContain("Stryker");
	});
});

describe("crawlSitePages — sanitize-html allowed tags and attributes", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("preserves img, figure, figcaption, picture, source tags and the documented allowed attributes", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const html = `<html><body><main>
			<figure id="fig1" class="hero"><picture><source srcset="x.webp" /><img src="x.png" alt="caption" width="100" height="50" loading="lazy" /></picture><figcaption>cap</figcaption></figure>
			<a href="/about" title="About link" rel="noopener">about</a>
		</main></body></html>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse(html));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		const body = result.pages[0]?.body ?? "";
		// Use distinct opening-tag substrings so a stripped tag (which sanitize-html
		// drops entirely while preserving siblings/children) cannot be matched by
		// another tag's prefix (e.g. "<figure" vs "<figcaption").
		expect(body).toMatch(/<figure[ >]/);
		expect(body).toMatch(/<figcaption[ >]/);
		expect(body).toMatch(/<picture[ >]/);
		expect(body).toMatch(/<source[ />]/);
		expect(body).toMatch(/<img[ />]/);
		expect(body).toContain('src="x.png"');
		expect(body).toContain('alt="caption"');
		expect(body).toContain('width="100"');
		expect(body).toContain('height="50"');
		expect(body).toContain('loading="lazy"');
		expect(body).toContain('id="fig1"');
		expect(body).toContain('class="hero"');
		expect(body).toContain('href="/about"');
		expect(body).toContain('title="About link"');
		expect(body).toContain('rel="noopener"');
	});
});

describe("crawlSitePages — sitemap parsing edge cases", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("filters out cross-origin URLs from the sitemap — neither pages nor failed contains the cross-origin URL", async () => {
		const sitemap = `<urlset>
			<url><loc>https://x.com/keep</loc></url>
			<url><loc>https://other.com/skip</loc></url>
		</urlset>`;
		const fetchSpy = vi.mocked(fetch);
		fetchSpy
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>K</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages.map((p) => p.url)).toEqual(["https://x.com/keep"]);
		// The cross-origin URL must never have been fetched at all (kills mutants
		// that turn isSameOrigin or its caller's `if` into `true`/`return true`).
		expect(result.failed).toEqual([]);
		expect(fetchSpy.mock.calls.map((c) => c[0])).not.toContain("https://other.com/skip");
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("trims surrounding whitespace from the <loc> text content before crawling", async () => {
		const sitemap = `<urlset><url><loc>   https://x.com/about   </loc></url></urlset>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>A</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages[0]?.url).toBe("https://x.com/about");
	});
});

describe("crawlSitePages — fetch options", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("sends 'Astropress-Crawler/1.0' as the User-Agent by default and an explicit override when provided", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		const fetchSpy = vi.mocked(fetch);
		fetchSpy
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>B</main></body></html>"))
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>B</main></body></html>"));

		await crawlSitePages({ siteUrl: "https://x.com" });
		const defaultHeaders = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<
			string,
			string
		>;
		expect(defaultHeaders["User-Agent"]).toBe("Astropress-Crawler/1.0");

		await crawlSitePages({ siteUrl: "https://x.com", userAgent: "Custom/9.9" });
		const customHeaders = (fetchSpy.mock.calls[2]?.[1] as RequestInit).headers as Record<
			string,
			string
		>;
		expect(customHeaders["User-Agent"]).toBe("Custom/9.9");
	});

	it("skips responses whose Content-Type is not text/html (e.g. application/pdf) without recording them as failures", async () => {
		const sitemap = `<urlset>
			<url><loc>https://x.com/page</loc></url>
			<url><loc>https://x.com/doc.pdf</loc></url>
		</urlset>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>P</main></body></html>"))
			.mockResolvedValueOnce(makeResponse("%PDF-1.7", 200, "application/pdf"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages.map((p) => p.url)).toEqual(["https://x.com/page"]);
		expect(result.failed).toEqual([]);
	});

	it("treats a missing Content-Type header as non-HTML (skipped, not failed)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		// Build a Response without a content-type header.
		const noTypeRes = new Response("body", { status: 200 });
		noTypeRes.headers.delete("content-type");
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(noTypeRes);
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.pages).toEqual([]);
		expect(result.failed).toEqual([]);
	});

	it("emits the documented sitemap-fetch-error warning prefix when the sitemap request itself rejects", async () => {
		vi.mocked(fetch)
			.mockRejectedValueOnce(new Error("dns fail"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>H</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.warnings.some((w) => w.startsWith("Could not fetch sitemap.xml: dns fail"))).toBe(
			true,
		);
	});

	it("returns empty arrays for failed and warnings on a fully successful crawl (initial state assertions)", async () => {
		const sitemap = `<urlset><url><loc>https://x.com/p</loc></url></urlset>`;
		vi.mocked(fetch)
			.mockResolvedValueOnce(makeResponse(sitemap, 200, "application/xml"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>OK</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(result.failed).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.pages).toHaveLength(1);
	});

	it("requests the sitemap from '<origin>/sitemap.xml' (not an empty URL) and falls back to '<origin>/' as the homepage", async () => {
		const fetchSpy = vi.mocked(fetch);
		fetchSpy
			.mockResolvedValueOnce(makeResponse("Not Found", 404))
			.mockResolvedValueOnce(makeResponse("<html><body><main>HOME</main></body></html>"));
		await crawlSitePages({ siteUrl: "https://x.com" });
		expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://x.com/sitemap.xml");
		expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://x.com/");
	});
});

// ---------------------------------------------------------------------------
// Sitemap-fetch-error path (catch block) — exercises the L168 fallback array
// and the catch-branch homepage-warning template literal.
// ---------------------------------------------------------------------------

describe("crawlSitePages — sitemap-fetch-error fallback (catch branch)", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("falls back to crawling the homepage URL when the sitemap fetch throws (urlsToVisit is set to ['<origin>/'])", async () => {
		const fetchSpy = vi.mocked(fetch);
		fetchSpy
			.mockRejectedValueOnce(new TypeError("network down"))
			.mockResolvedValueOnce(makeResponse("<html><body><main>HOME</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://x.com/");
		expect(result.pages).toHaveLength(1);
		expect(result.pages[0]?.url).toBe("https://x.com/");
	});

	it("formats a non-Error rejection via String(err) in the catch-branch warning", async () => {
		vi.mocked(fetch)
			.mockRejectedValueOnce("plain-string-rejection")
			.mockResolvedValueOnce(makeResponse("<html><body><main>H</main></body></html>"));
		const result = await crawlSitePages({ siteUrl: "https://x.com" });
		expect(
			result.warnings.some((w) =>
				w.startsWith("Could not fetch sitemap.xml: plain-string-rejection"),
			),
		).toBe(true);
	});
});
