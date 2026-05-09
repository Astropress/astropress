import { describe, expect, it } from "vitest";
import { detectUnsupportedPatterns, parseWordPressExport } from "../src/import/wordpress-xml.js";

const channel = (items: string[], extras = "") =>
	`<rss><channel>${extras}${items.join("")}</channel></rss>`;

describe("parseWordPressExport — author fallback identifiers", () => {
	it("uses 'author-{N}' id when wp:author_id is missing", () => {
		const xml = channel([], "<wp:author><wp:author_login>admin</wp:author_login></wp:author>");
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors[0].id).toBe("author-1");
	});

	it("uses 'author-{N}' login fallback when wp:author_login is missing", () => {
		const xml = channel([], "<wp:author><wp:author_id>5</wp:author_id></wp:author>");
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors[0].login).toBe("author-1");
	});

	it("uses 'Author {N}' as the third displayName fallback", () => {
		const xml = channel([], "<wp:author><wp:author_id>5</wp:author_id></wp:author>");
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors[0].displayName).toBe("Author 1");
	});

	it("uses author_login as displayName fallback before 'Author {N}'", () => {
		const xml = channel([], "<wp:author><wp:author_login>jdoe</wp:author_login></wp:author>");
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors[0].displayName).toBe("jdoe");
	});

	it("increments index across multiple authors (kills index+1 / index-1 mutants)", () => {
		const xml = channel(
			[],
			"<wp:author></wp:author><wp:author><wp:author_login>jane</wp:author_login></wp:author>",
		);
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors.map((a) => a.id)).toEqual(["author-1", "author-2"]);
		expect(bundle.authors.map((a) => a.displayName)).toEqual(["Author 1", "jane"]);
	});
});

describe("parseWordPressExport — content fallback identifiers", () => {
	it("uses 'item-{N}' legacyId when wp:post_id is missing", () => {
		const xml = channel([
			"<item><wp:post_type>post</wp:post_type><wp:post_name>x</wp:post_name><link>/x/</link><title>X</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].legacyId).toBe("item-1");
	});

	it("increments item index across multiple unidentified items (kills index+1 / index-1 mutants)", () => {
		const xml = channel([
			"<item><wp:post_type>post</wp:post_type><wp:post_name>a</wp:post_name><link>/a/</link><title>A</title></item>",
			"<item><wp:post_type>post</wp:post_type><wp:post_name>b</wp:post_name><link>/b/</link><title>B</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords.map((r) => r.legacyId)).toEqual(["item-1", "item-2"]);
	});

	it("uses 'Untitled {legacyId}' title fallback", () => {
		const xml = channel([
			"<item><wp:post_id>42</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>x</wp:post_name><link>/x/</link></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].title).toBe("Untitled 42");
	});

	it("derives slug from legacyUrl path when wp:post_name is missing", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><link>/blog/derived-from-url/</link><title>T</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].slug).toBe("derived-from-url");
	});

	it("uses 'legacy' fallback when wp:meta_value is empty for _wp_old_slug", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:postmeta><wp:meta_key>_wp_old_slug</wp:meta_key><wp:meta_value></wp:meta_value></wp:postmeta></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].oldSlugs).toEqual(["legacy"]);
	});

	it("uses 'term' fallback when category nicename and value are both empty", () => {
		const xml = channel([
			'<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><category domain="category" nicename=""></category></item>',
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].categorySlugs).toEqual(["term"]);
	});
});

describe("parseWordPressExport — comment fallbacks", () => {
	it("uses 'Anonymous' when wp:comment_author is missing", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_id>c1</wp:comment_id></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments[0].authorName).toBe("Anonymous");
	});

	it("uses '{legacyId}-{N}' as comment legacyId fallback when wp:comment_id is missing", () => {
		const xml = channel([
			"<item><wp:post_id>5</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_author>X</wp:comment_author></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments[0].legacyId).toBe("5-1");
	});

	it("classifies comment status 'approved' iff wp:comment_approved is exactly '1'", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_id>a</wp:comment_id><wp:comment_approved>1</wp:comment_approved></wp:comment><wp:comment><wp:comment_id>b</wp:comment_id><wp:comment_approved>0</wp:comment_approved></wp:comment><wp:comment><wp:comment_id>c</wp:comment_id></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments.map((c) => c.status)).toEqual(["approved", "pending", "pending"]);
	});
});

describe("parseWordPressExport — entity ID prefix conventions", () => {
	it("namespaces term map keys with 'category:' / 'tag:' (no slug collision across kinds)", () => {
		const xml = channel([
			'<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><category domain="category" nicename="x"><![CDATA[X-cat]]></category><category domain="post_tag" nicename="x"><![CDATA[X-tag]]></category></item>',
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.terms).toHaveLength(2);
		const byKind = Object.fromEntries(bundle.terms.map((t) => [t.kind, t.name]));
		expect(byKind).toEqual({ category: "X-cat", tag: "X-tag" });
		// Both have slug "x" but the map keys distinguish them — collision would
		// drop one entry to length 1.
	});

	it("emits redirect id 'redirect-{legacyId}-{oldSlug}' / recordId '{kind}-{legacyId}' / reason 'wp_old_slug'", () => {
		const xml = channel([
			"<item><wp:post_id>42</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>new-name</wp:post_name><link>/blog/new-name/</link><title>T</title><wp:postmeta><wp:meta_key>_wp_old_slug</wp:meta_key><wp:meta_value>old-name</wp:meta_value></wp:postmeta></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.redirects).toEqual([
			{
				id: "redirect-42-old-name",
				sourcePath: "/blog/old-name/",
				targetPath: "/blog/new-name/",
				reason: "wp_old_slug",
				recordId: "post-42",
			},
		]);
	});

	it("emits comment id 'comment-{legacyId}-{N}' and recordId '{kind}-{legacyId}'", () => {
		const xml = channel([
			"<item><wp:post_id>5</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_id>c1</wp:comment_id><wp:comment_author>A</wp:comment_author></wp:comment><wp:comment><wp:comment_id>c2</wp:comment_id><wp:comment_author>B</wp:comment_author></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments[0].id).toBe("comment-5-1");
		expect(bundle.comments[1].id).toBe("comment-5-2");
		expect(bundle.comments[0].recordId).toBe("post-5");
	});

	it("emits media id 'media-{legacyId}' and uses '{slug || legacyId}.bin' filename when URL is missing", () => {
		const xml = channel([
			"<item><wp:post_id>201</wp:post_id><wp:post_type>attachment</wp:post_type><wp:post_name>my-photo</wp:post_name></item>",
			"<item><wp:post_id>202</wp:post_id><wp:post_type>attachment</wp:post_type></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.mediaAssets[0]).toMatchObject({
			id: "media-201",
			filename: "my-photo.bin",
		});
		expect(bundle.mediaAssets[1]).toMatchObject({
			id: "media-202",
			filename: "202.bin",
		});
	});

	it("emits content record id '{kind}-{legacyId}' for both post and page kinds", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>a</wp:post_name><link>/a/</link><title>A</title></item>",
			"<item><wp:post_id>2</wp:post_id><wp:post_type>page</wp:post_type><wp:post_name>b</wp:post_name><link>/b/</link><title>B</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords.map((r) => r.id).sort()).toEqual(["page-2", "post-1"]);
	});
});

describe("parseWordPressExport — date precedence and skipped types", () => {
	it("prefers wp:post_date_gmt over wp:post_date for publishedAt", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:post_date_gmt>2024-06-01 00:00:00</wp:post_date_gmt><wp:post_date>2024-05-31 17:00:00</wp:post_date></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].publishedAt).toBe("2024-06-01 00:00:00");
	});

	it("falls back to wp:post_date when wp:post_date_gmt is absent", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:post_date>2024-05-31 17:00:00</wp:post_date></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].publishedAt).toBe("2024-05-31 17:00:00");
	});

	it("counts unrecognised post types in skipped (kills the postType !== post && !== page && !== attachment fallthrough)", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>nav_menu_item</wp:post_type></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.entityCounts.skipped).toBe(1);
		expect(bundle.contentRecords).toHaveLength(0);
		expect(bundle.mediaAssets).toHaveLength(0);
	});
});

describe("detectUnsupportedPatterns — exact warnings and false branch", () => {
	it("returns exactly ['shortcodes'] and the shortcode warning text", () => {
		const result = detectUnsupportedPatterns("[gallery ids=1]");
		expect(result.unsupportedPatterns).toEqual(["shortcodes"]);
		expect(result.warnings).toEqual([
			"WordPress shortcodes were detected; staged content will need manual review.",
		]);
	});

	it("returns exactly ['page-builder-markup'] and the page-builder warning text", () => {
		const result = detectUnsupportedPatterns("<div class='vc_row'></div>");
		expect(result.unsupportedPatterns).toEqual(["page-builder-markup"]);
		expect(result.warnings).toEqual([
			"WordPress page-builder markup was detected; staged content will need manual cleanup.",
		]);
	});

	it("returns empty patterns and warnings for plain content (false branches)", () => {
		const result = detectUnsupportedPatterns("<p>Just a normal paragraph.</p>");
		expect(result.shortcodeMatches).toBe(0);
		expect(result.builderMatches).toBe(0);
		expect(result.unsupportedPatterns).toEqual([]);
		expect(result.warnings).toEqual([]);
	});
});

describe("parseWordPressExport — author/creator matching", () => {
	it("uses dc:creator-matched author login when creator matches", () => {
		const xml = channel(
			[
				"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><dc:creator><![CDATA[admin]]></dc:creator></item>",
			],
			"<wp:author><wp:author_id>9</wp:author_id><wp:author_login><![CDATA[admin]]></wp:author_login></wp:author><wp:author><wp:author_id>10</wp:author_id><wp:author_login><![CDATA[bob]]></wp:author_login></wp:author>",
		);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].authorLogins).toEqual(["admin"]);
	});

	it("falls back to first author login when dc:creator doesn't match any known login", () => {
		const xml = channel(
			[
				"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><dc:creator><![CDATA[ghost]]></dc:creator></item>",
			],
			"<wp:author><wp:author_id>9</wp:author_id><wp:author_login><![CDATA[admin]]></wp:author_login></wp:author>",
		);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].authorLogins).toEqual(["admin"]);
	});

	it("emits authorLogins=[] when there are no authors at all", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].authorLogins).toEqual([]);
	});
});

describe("parseWordPressExport — preserves explicit IDs (kills always-use-fallback mutants)", () => {
	it("uses wp:author_id verbatim when present", () => {
		const xml = channel(
			[],
			"<wp:author><wp:author_id>seven</wp:author_id><wp:author_login>admin</wp:author_login></wp:author>",
		);
		const bundle = parseWordPressExport(xml);
		expect(bundle.authors[0].id).toBe("seven");
	});

	it("uses wp:post_id verbatim when present", () => {
		const xml = channel([
			"<item><wp:post_id>99</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>x</wp:post_name><link>/x/</link><title>X</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].legacyId).toBe("99");
	});

	it("uses item title verbatim when present (kills always-use-Untitled fallback)", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>Real Title</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].title).toBe("Real Title");
	});

	it("uses wp:comment_id verbatim when present (kills always-use-{legacyId}-{N} fallback)", () => {
		const xml = channel([
			"<item><wp:post_id>5</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_id>real-c1</wp:comment_id><wp:comment_author>X</wp:comment_author></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments[0].legacyId).toBe("real-c1");
	});

	it("uses wp:comment_author verbatim when present (kills always-use-Anonymous fallback)", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:comment><wp:comment_id>c1</wp:comment_id><wp:comment_author>Pat Reader</wp:comment_author></wp:comment></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.comments[0].authorName).toBe("Pat Reader");
	});

	it("uses category nicename verbatim when present (kills always-use-'term' fallback)", () => {
		const xml = channel([
			'<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><category domain="category" nicename="my-cat"><![CDATA[My Cat]]></category></item>',
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].categorySlugs).toEqual(["my-cat"]);
	});

	it("uses wp:meta_value verbatim when present (kills always-use-'legacy' fallback)", () => {
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><wp:postmeta><wp:meta_key>_wp_old_slug</wp:meta_key><wp:meta_value>real-old</wp:meta_value></wp:postmeta></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.contentRecords[0].oldSlugs).toEqual(["real-old"]);
	});
});

describe("parseWordPressExport — joiner separator", () => {
	it("joins remediation candidate content with newlines (kills '\\n' → '' separator mutant)", () => {
		// Two posts: one has shortcode markers, one is clean. Newline join is what
		// keeps body+excerpt boundaries from concatenating into the regex window.
		const xml = channel([
			"<item><wp:post_id>1</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>p</wp:post_name><link>/p/</link><title>T</title><content:encoded><![CDATA[hello]]></content:encoded><excerpt:encoded><![CDATA[[gallery]]]></excerpt:encoded></item>",
			"<item><wp:post_id>2</wp:post_id><wp:post_type>page</wp:post_type><wp:post_name>q</wp:post_name><link>/q/</link><title>T2</title></item>",
		]);
		const bundle = parseWordPressExport(xml);
		expect(bundle.remediationCandidates).toEqual(["post-1"]);
		expect(bundle.unsupportedPatterns).toContain("shortcodes");
	});
});
