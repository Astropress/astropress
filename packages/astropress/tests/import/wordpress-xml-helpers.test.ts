import { describe, expect, it } from "vitest";
import {
	countMatches,
	decodeXml,
	escapeRegExp,
	filenameFromUrl,
	getAttributeValue,
	getBlocks,
	getTagText,
	inferMimeType,
	normalizeContentStatus,
	normalizePathname,
	normalizeSlug,
	parseCategoryBlocks,
	safeArtifactFilename,
	stripCdata,
	XML_ENTITY_LOOKUP,
} from "../../src/import/wordpress-xml-helpers";

describe("XML_ENTITY_LOOKUP", () => {
	it("re-exports the entity table with the common named entities", () => {
		expect(XML_ENTITY_LOOKUP.amp).toBe("&");
		expect(XML_ENTITY_LOOKUP.lt).toBe("<");
		expect(XML_ENTITY_LOOKUP.gt).toBe(">");
		expect(XML_ENTITY_LOOKUP.quot).toBe('"');
	});
});

describe("countMatches", () => {
	it("returns the number of pattern matches in the source string", () => {
		expect(countMatches("a, b, c", /,/g)).toBe(2);
		expect(countMatches("aaa", /a/g)).toBe(3);
	});

	it("returns 0 when the pattern does not match", () => {
		expect(countMatches("abc", /z/g)).toBe(0);
	});
});

describe("escapeRegExp", () => {
	it("escapes every regex meta-character", () => {
		expect(escapeRegExp("a.b*c+?")).toBe("a\\.b\\*c\\+\\?");
		expect(escapeRegExp("$^{}()|[]\\")).toBe("\\$\\^\\{\\}\\(\\)\\|\\[\\]\\\\");
	});

	it("leaves plain identifiers unchanged", () => {
		expect(escapeRegExp("hello-world")).toBe("hello-world");
	});
});

describe("stripCdata", () => {
	it("removes a leading <![CDATA[ and trailing ]]> wrapper", () => {
		expect(stripCdata("<![CDATA[hello]]>")).toBe("hello");
	});

	it("returns the original string when no CDATA wrapper is present", () => {
		expect(stripCdata("plain")).toBe("plain");
	});

	it("strips only the leading CDATA when the closing ]]> is missing (and vice-versa)", () => {
		expect(stripCdata("<![CDATA[half")).toBe("half");
		expect(stripCdata("half]]>")).toBe("half");
	});
});

describe("decodeXml", () => {
	it("decodes named entities (amp, lt, gt, quot, apos)", () => {
		expect(decodeXml("a&amp;b")).toBe("a&b");
		expect(decodeXml("&lt;tag&gt;")).toBe("<tag>");
		expect(decodeXml("&quot;hi&quot;")).toBe('"hi"');
		expect(decodeXml("&apos;x&apos;")).toBe("'x'");
	});

	it("decodes decimal numeric entities (&#65; = A)", () => {
		expect(decodeXml("&#65;&#66;&#67;")).toBe("ABC");
	});

	it("decodes hexadecimal numeric entities (&#x41; = A)", () => {
		expect(decodeXml("&#x41;&#x42;")).toBe("AB");
	});

	it("preserves an unrecognised named entity untouched", () => {
		expect(decodeXml("&zzz;rest")).toBe("&zzz;rest");
	});

	it("strips CDATA before decoding", () => {
		expect(decodeXml("<![CDATA[A&amp;B]]>")).toBe("A&B");
	});
});

describe("getTagText", () => {
	it("returns the trimmed, decoded inner text of the first matching tag", () => {
		expect(getTagText("<title>  Hello&amp;world  </title>", "title")).toBe("Hello&world");
	});

	it("returns '' when the tag is absent", () => {
		expect(getTagText("<p>x</p>", "title")).toBe("");
	});

	it("ignores attributes inside the opening tag", () => {
		expect(getTagText('<title lang="en">Hi</title>', "title")).toBe("Hi");
	});
});

describe("getBlocks", () => {
	it("returns the inner content of every matching tag in document order", () => {
		expect(getBlocks("<item>a</item><item>b</item>", "item")).toEqual(["a", "b"]);
	});

	it("returns [] when no blocks are present", () => {
		expect(getBlocks("<p>x</p>", "item")).toEqual([]);
	});

	it("is case-insensitive and tolerates attributes", () => {
		expect(getBlocks('<ITEM id="1">a</ITEM><item>b</item>', "item")).toEqual(["a", "b"]);
	});
});

describe("parseCategoryBlocks", () => {
	it("returns { attributes, value } for every <category> block", () => {
		const blocks = parseCategoryBlocks(
			'<category domain="post_tag" nicename="x">Tag X</category><category domain="category" nicename="y">  Cat Y  </category>',
		);
		expect(blocks).toEqual([
			{ attributes: ' domain="post_tag" nicename="x"', value: "Tag X" },
			{ attributes: ' domain="category" nicename="y"', value: "Cat Y" },
		]);
	});

	it("decodes XML entities in the value", () => {
		expect(parseCategoryBlocks("<category>A&amp;B</category>")).toEqual([
			{ attributes: "", value: "A&B" },
		]);
	});

	it("returns [] when there are no <category> blocks", () => {
		expect(parseCategoryBlocks("<p>x</p>")).toEqual([]);
	});
});

describe("getAttributeValue", () => {
	it("returns the decoded value of the named attribute", () => {
		expect(getAttributeValue(' domain="post_tag" nicename="x"', "domain")).toBe("post_tag");
	});

	it("decodes XML entities in the value", () => {
		expect(getAttributeValue(' title="A&amp;B"', "title")).toBe("A&B");
	});

	it("returns '' when the attribute is absent", () => {
		expect(getAttributeValue(' domain="x"', "missing")).toBe("");
	});
});

describe("normalizeSlug", () => {
	it("lowercases and converts non-allowed chars to dashes, collapsing runs", () => {
		expect(normalizeSlug("Hello World!", "fb")).toBe("hello-world");
		expect(normalizeSlug("multiple   spaces and !!! marks", "fb")).toBe(
			"multiple-spaces-and-marks",
		);
	});

	it("preserves slashes (used for legacy URLs) and underscores", () => {
		expect(normalizeSlug("/blog/my_post/", "fb")).toBe("blog/my_post");
	});

	it("trims leading/trailing slashes and dashes", () => {
		expect(normalizeSlug("---hi---", "fb")).toBe("hi");
		expect(normalizeSlug("///hi///", "fb")).toBe("hi");
	});

	it("returns fallback when the sanitised value is empty", () => {
		expect(normalizeSlug("!!!", "FALLBACK")).toBe("FALLBACK");
		expect(normalizeSlug("", "FALLBACK")).toBe("FALLBACK");
	});
});

describe("normalizePathname", () => {
	it("returns '/<fallbackSlug>/' for empty input", () => {
		expect(normalizePathname("", "post-1")).toBe("/post-1/");
	});

	it("extracts the pathname from a full URL, adding a trailing slash", () => {
		expect(normalizePathname("https://example.com/blog/post", "fb")).toBe("/blog/post/");
	});

	it("preserves an existing trailing slash unchanged", () => {
		expect(normalizePathname("https://example.com/blog/", "fb")).toBe("/blog/");
	});

	it("collapses double-slashes to single slashes", () => {
		expect(normalizePathname("https://example.com//double//path/", "fb")).toBe("/double/path/");
	});

	it("decodes an http URL pathname and trims trailing slashes appropriately", () => {
		expect(normalizePathname("http://example.com//a//b", "fb")).toBe("/a/b/");
	});
});

describe("normalizeContentStatus", () => {
	it("maps WP 'publish' to 'published'", () => {
		expect(normalizeContentStatus("publish")).toBe("published");
		// Trim + case-insensitive
		expect(normalizeContentStatus("  PUBLISH  ")).toBe("published");
	});

	it("maps WP draft / pending / future to 'draft'", () => {
		expect(normalizeContentStatus("draft")).toBe("draft");
		expect(normalizeContentStatus("pending")).toBe("draft");
		expect(normalizeContentStatus("future")).toBe("draft");
	});

	it("falls back to 'archived' for any other status", () => {
		expect(normalizeContentStatus("trash")).toBe("archived");
		expect(normalizeContentStatus("")).toBe("archived");
	});
});

describe("inferMimeType", () => {
	it("returns the mapped mime type for known extensions", () => {
		expect(inferMimeType("photo.jpg")).toBe("image/jpeg");
		expect(inferMimeType("PHOTO.JPG")).toBe("image/jpeg");
		expect(inferMimeType("photo.png")).toBe("image/png");
		expect(inferMimeType("photo.WEBP")).toBe("image/webp");
		expect(inferMimeType("doc.pdf")).toBe("application/pdf");
	});

	it("falls back to the default mime when the extension is unknown", () => {
		const fallback = inferMimeType("file.unknown-extension-xyz");
		expect(typeof fallback).toBe("string");
		expect(fallback.length).toBeGreaterThan(0);
	});

	it("falls back when the filename has no extension at all", () => {
		const fallback = inferMimeType("no-extension");
		expect(typeof fallback).toBe("string");
	});
});

describe("filenameFromUrl", () => {
	it("returns the last path segment of the URL", () => {
		expect(filenameFromUrl("https://example.com/path/to/file.jpg", "fb")).toBe("file.jpg");
	});

	it("returns fallback when the URL path has no last segment (root URL)", () => {
		expect(filenameFromUrl("https://example.com/", "FB")).toBe("FB");
	});

	it("returns fallback on URL parse error", () => {
		expect(filenameFromUrl("not a url", "FB")).toBe("FB");
	});
});

describe("safeArtifactFilename", () => {
	it("replaces unsafe characters with dashes and collapses runs", () => {
		expect(safeArtifactFilename("a b!c@d", "fb")).toBe("a-b-c-d");
	});

	it("preserves dots, underscores, and dashes", () => {
		expect(safeArtifactFilename("name_v1.2-final.txt", "fb")).toBe("name_v1.2-final.txt");
	});

	it("returns the dash for an all-unsafe filename (consecutive runs collapsed to a single dash)", () => {
		// All-unsafe → single "-" after collapse. The sanitiser only returns the
		// fallback when the result is the empty string.
		expect(safeArtifactFilename("!!!!", "FB")).toBe("-");
	});

	it("returns fallback when input is empty", () => {
		expect(safeArtifactFilename("", "FB")).toBe("FB");
	});
});
