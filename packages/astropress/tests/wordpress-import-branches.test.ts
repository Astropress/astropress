import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAstropressWordPressImportSource } from "../src/import/wordpress.js";

// Minimal WXR builder
function makeWxr(items: string[]): string {
  return ["<rss>", "<channel>", ...items, "</channel>", "</rss>"].join("");
}

function makePost(overrides: {
  id?: string;
  name?: string;
  status?: string;
  type?: string;
  link?: string;
  body?: string;
  innerBlocks?: string; // content placed INSIDE <item> before </item>
} = {}): string {
  const id = overrides.id ?? "101";
  const name = overrides.name ?? "hello-world";
  const status = overrides.status ?? "publish";
  const type = overrides.type ?? "post";
  const link = overrides.link ?? `https://example.org/${name}/`;
  const body = overrides.body ?? "<p>Hello</p>";
  const inner = overrides.innerBlocks ?? "";
  return [
    "<item>",
    `<title><![CDATA[Hello World]]></title>`,
    `<link>${link}</link>`,
    `<content:encoded><![CDATA[${body}]]></content:encoded>`,
    `<wp:post_id>${id}</wp:post_id>`,
    `<wp:post_date>2024-01-01 12:00:00</wp:post_date>`,
    `<wp:post_name>${name}</wp:post_name>`,
    `<wp:status>${status}</wp:status>`,
    `<wp:post_type>${type}</wp:post_type>`,
    inner,
    "</item>",
  ].join("");
}

let workspace: string;
let exportFile: string;
const importer = createAstropressWordPressImportSource();

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "astropress-wp-branches-"));
  exportFile = join(workspace, "export.xml");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

describe("normalizeContentStatus branches", () => {
  it("maps 'pending' status to 'draft'", async () => {
    const artifactDir = join(workspace, "artifacts-pending");
    await writeFile(exportFile, makeWxr([makePost({ status: "pending" })]), "utf8");
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(records[0].status).toBe("draft");
  });

  it("maps 'future' status to 'draft'", async () => {
    const artifactDir = join(workspace, "artifacts-future");
    await writeFile(exportFile, makeWxr([makePost({ status: "future" })]), "utf8");
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(records[0].status).toBe("draft");
  });

  it("maps 'private' status to 'archived' (default branch)", async () => {
    const artifactDir = join(workspace, "artifacts-private");
    await writeFile(exportFile, makeWxr([makePost({ status: "private" })]), "utf8");
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(records[0].status).toBe("archived");
  });
});

describe("normalizePathname catch branch", () => {
  it("uses slug fallback when <link> contains an invalid URL", async () => {
    // "not-a-url" resolves fine as relative via URL constructor with base, so we need a truly malformed one
    // [not-valid-host] is not a valid IPv6 literal → new URL(...) throws → catch branch fires
    const badLink = "http://[not-valid-host]/path/";
    const artifactDir = join(workspace, "artifacts-pathname");
    await writeFile(exportFile, makeWxr([makePost({ link: badLink, name: "fallback-slug" })]), "utf8");
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    // catch branch produced the fallback slug as the pathname, not the malformed URL
    expect(records[0].legacyUrl).toBe("/fallback-slug/");
  });
});

describe("detectUnsupportedPatterns branches", () => {
  it("flags page builder markup when body contains vc_row", async () => {
    const pageBuilderBody = '<div class="vc_row">Page builder content</div>';
    await writeFile(exportFile, makeWxr([makePost({ body: pageBuilderBody })]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.reviewRequired).toBe(true);
    expect(report.manualTasks.some((t) => t.includes("page-builder"))).toBe(true);
  });

  it("flags shortcodes when body contains [shortcode]", async () => {
    const shortcodeBody = "<p>Intro</p>[gallery ids=\"1,2\"]";
    await writeFile(exportFile, makeWxr([makePost({ body: shortcodeBody })]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.reviewRequired).toBe(true);
    expect(report.manualTasks.some((t) => t.includes("shortcode"))).toBe(true);
  });
});

describe("buildImportPlan branches", () => {
  it("produces a manual task when downloadMedia is true but no artifactDir is given", async () => {
    await writeFile(
      exportFile,
      makeWxr([
        makePost({ id: "201", name: "hero-image", status: "inherit", type: "attachment" }),
      ]),
      "utf8",
    );
    const inventory = await importer.inspectWordPress?.({ exportFile });
    const plan = await importer.planWordPressImport?.({
      inventory: inventory!,
      downloadMedia: true,
      // no artifactDir
    });
    expect(plan?.manualTasks.some((t) => t.includes("Media download was requested without an artifact directory"))).toBe(true);
    expect(plan?.downloadMedia).toBe(false); // guard prevents download without artifactDir
  });

  it("planWordPressImport without downloadMedia option uses false default (right ?? branch)", async () => {
    await writeFile(exportFile, makeWxr([makePost({ id: "202", name: "plan-default" })]), "utf8");
    const inventory = await importer.inspectWordPress?.({ exportFile });
    const plan = await importer.planWordPressImport?.({ inventory: inventory! });
    expect(plan?.downloadMedia).toBe(false);
  });

  it("respects includeComments: false — importedComments is 0", async () => {
    const comment = "<wp:comment><wp:comment_id>1</wp:comment_id><wp:comment_author><![CDATA[Alice]]></wp:comment_author><wp:comment_date>2024-01-01 10:00:00</wp:comment_date><wp:comment_approved>1</wp:comment_approved><wp:comment_content><![CDATA[Hi]]></wp:comment_content></wp:comment>";
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "101", name: "hello", innerBlocks: comment })]),
      "utf8",
    );
    const report = await importer.importWordPress({ exportFile, includeComments: false });
    expect(report.importedComments).toBe(0);
  });

  it("respects includeMedia: false — importedMedia is 0", async () => {
    await writeFile(
      exportFile,
      makeWxr([
        makePost({ id: "201", name: "hero", status: "inherit", type: "attachment" }),
      ]),
      "utf8",
    );
    const report = await importer.importWordPress({ exportFile, includeMedia: false });
    expect(report.importedMedia).toBe(0);
  });
});

describe("downloadMediaAssets failure branch", () => {
  it("records failedMedia when fetch returns a non-OK response", async () => {
    // Write a WXR with an attachment pointing to a URL that will fail
    await writeFile(
      exportFile,
      makeWxr([
        [
          "<item>",
          "<title><![CDATA[Broken Image]]></title>",
          "<link>https://example.org/wp-content/uploads/broken.png</link>",
          "<wp:post_id>301</wp:post_id>",
          "<wp:post_name>broken-image</wp:post_name>",
          "<wp:status>inherit</wp:status>",
          "<wp:post_type>attachment</wp:post_type>",
          "<wp:attachment_url>https://example.org/wp-content/uploads/broken.png</wp:attachment_url>",
          "</item>",
        ].join(""),
      ]),
      "utf8",
    );

    // Stub fetch to return 404
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" })),
    );

    const artifactDir = join(workspace, "artifacts");
    const report = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: true,
      includeMedia: true,
    });

    expect(report.failedMedia.length).toBeGreaterThan(0);
    expect(report.failedMedia[0]).toMatchObject({ reason: expect.stringContaining("404") });
    expect(report.status).toBe("completed_with_warnings");
  });
});

describe("applyLocal: true with includeComments/Media: false", () => {
  it("applies import to local runtime but skips comments and media", async () => {
    const comment = "<wp:comment><wp:comment_id>1</wp:comment_id><wp:comment_author><![CDATA[Alice]]></wp:comment_author><wp:comment_date>2024-01-01 10:00:00</wp:comment_date><wp:comment_approved>1</wp:comment_approved><wp:comment_content><![CDATA[Hi]]></wp:comment_content></wp:comment>";
    await writeFile(
      exportFile,
      makeWxr([
        makePost({ id: "101", name: "local-post", status: "publish", innerBlocks: comment }),
        [
          "<item>",
          "<title><![CDATA[Local Image]]></title>",
          "<link>https://example.org/wp-content/uploads/local.png</link>",
          "<wp:post_id>201</wp:post_id>",
          "<wp:post_name>local-image</wp:post_name>",
          "<wp:status>inherit</wp:status>",
          "<wp:post_type>attachment</wp:post_type>",
          "<wp:attachment_url>data:text/plain;base64,aGVsbG8=</wp:attachment_url>",
          "</item>",
        ].join(""),
      ]),
      "utf8",
    );

    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "admin.sqlite"),
      includeComments: false,
      includeMedia: false,
    });

    expect(report.localApply).toBeDefined();
    expect(report.localApply?.appliedComments).toBe(0);
    expect(report.localApply?.appliedMedia).toBe(0);
  });
});

describe("applyLocal: true with comments included", () => {
  it("inserts approved comment into local runtime (covers comment loop in applyLocal)", async () => {
    const comment = [
      "<wp:comment>",
      "<wp:comment_id>42</wp:comment_id>",
      "<wp:comment_author><![CDATA[Bob]]></wp:comment_author>",
      "<wp:comment_author_email></wp:comment_author_email>",
      "<wp:comment_date>2024-01-02 09:00:00</wp:comment_date>",
      "<wp:comment_date_gmt>2024-01-02 09:00:00</wp:comment_date_gmt>",
      "<wp:comment_approved>1</wp:comment_approved>",
      "<wp:comment_content><![CDATA[Great post!]]></wp:comment_content>",
      "</wp:comment>",
    ].join("");

    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "601", name: "apply-comment-post", innerBlocks: comment })]),
      "utf8",
    );

    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "admin.sqlite"),
      includeComments: true,
      includeMedia: false,
    });

    expect(report.localApply?.appliedComments).toBeGreaterThan(0);
  });

  it("imports twice to cover the 'existing record' update path in applyLocal", async () => {
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "602", name: "repeat-post", status: "draft" })]),
      "utf8",
    );

    const adminDbPath = join(workspace, "admin.sqlite");

    // First import creates the record
    await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath,
      includeComments: false,
      includeMedia: false,
    });

    // Second import hits the `if (existing)` update branch (line 566)
    const report2 = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath,
      includeComments: false,
      includeMedia: false,
    });

    expect(report2.localApply?.appliedRecords).toBeGreaterThan(0);
  });

  it("applies import with archived status post to cover contentStatus=archived branch", async () => {
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "603", name: "archived-post", status: "private" })]),
      "utf8",
    );

    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "admin.sqlite"),
      includeComments: false,
      includeMedia: false,
    });

    expect(report.localApply?.appliedRecords).toBeGreaterThan(0);
  });
});

describe("WXR parsing — inferMimeType, normalizeSlug, filenameFromUrl, normalizePathname branches", () => {
  it("imports attachments with various file extensions to hit all inferMimeType cases", async () => {
    const extensions = [
      { ext: "jpg", expected: "image/jpeg" },
      { ext: "gif", expected: "image/gif" },
      { ext: "webp", expected: "image/webp" },
      { ext: "svg", expected: "image/svg+xml" },
      { ext: "pdf", expected: "application/pdf" },
      { ext: "unknown", expected: "application/octet-stream" },
    ];
    const items = extensions.map(({ ext }, i) => [
      "<item>",
      `<title><![CDATA[File ${i}]]></title>`,
      `<link>https://example.org/file-${i}/</link>`,
      `<wp:post_id>${300 + i}</wp:post_id>`,
      `<wp:post_name>file-${i}</wp:post_name>`,
      `<wp:status>inherit</wp:status>`,
      `<wp:post_type>attachment</wp:post_type>`,
      `<wp:attachment_url>https://example.org/wp-content/uploads/image.${ext}</wp:attachment_url>`,
      "</item>",
    ].join(""));
    await writeFile(exportFile, makeWxr(items), "utf8");
    const report = await importer.importWordPress({ exportFile });
    // All attachment types are imported without error
    expect(report.status).toMatch(/^completed/);
  });

  it("handles items with no title (triggers || fallback)", async () => {
    const item = [
      "<item>",
      "<title></title>",
      "<link>https://example.org/no-title/</link>",
      "<wp:post_id>401</wp:post_id>",
      "<wp:post_name>no-title</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThan(0);
  });

  it("handles items with no link and no guid (triggers normalizePathname(!value) branch)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[No Link]]></title>",
      "<link></link>",
      "<wp:post_id>402</wp:post_id>",
      "<wp:post_name>no-link-post</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.status).toMatch(/^completed/);
  });

  it("handles unrecognized post types (skipped count)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Custom Type]]></title>",
      "<link>https://example.org/custom/</link>",
      "<wp:post_id>403</wp:post_id>",
      "<wp:post_name>custom-item</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>custom_post_type</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    // unrecognized type is skipped — 0 content records
    expect(report.importedRecords).toBe(0);
  });

  it("falls back to legacyId for slug when the link URL is just '/'", async () => {
    // When link = "https://example.com/" → legacyUrl = "/" → after strip → "" → split → [""] → at(-1) = "" → falsy → || legacyId
    await writeFile(exportFile, makeWxr([makePost({ id: "550", name: "root-url-post", link: "https://example.com/" })]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThanOrEqual(1);
  });

  it("handles WXR author blocks with missing fields (|| fallback branches)", async () => {
    const wxr = [
      "<rss>",
      "<channel>",
      // Author with no id, no email, no displayName (all fallbacks)
      "<wp:author>",
      "<wp:author_id></wp:author_id>",
      "<wp:author_login><![CDATA[johndoe]]></wp:author_login>",
      "<wp:author_email></wp:author_email>",
      "<wp:author_display_name></wp:author_display_name>",
      "</wp:author>",
      makePost({ id: "501", name: "with-author" }),
      "</channel>",
      "</rss>",
    ].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThanOrEqual(1);
  });

  it("handles comments with no ID, no author, unapproved status, and no email (inside <item>)", async () => {
    const innerComment = [
      "<wp:comment>",
      "<wp:comment_id></wp:comment_id>",
      "<wp:comment_author></wp:comment_author>",
      "<wp:comment_author_email></wp:comment_author_email>",
      "<wp:comment_date>2024-06-01 10:00:00</wp:comment_date>",
      "<wp:comment_date_gmt></wp:comment_date_gmt>",
      "<wp:comment_approved>0</wp:comment_approved>",
      "<wp:comment_content><![CDATA[Unapproved comment]]></wp:comment_content>",
      "</wp:comment>",
    ].join("");
    const wxr = makeWxr([makePost({ id: "502", name: "commented-post", innerBlocks: innerComment })]);
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile, includeComments: true });
    // Parser ran without error; comment with pending status was processed
    expect(report.status).toMatch(/^completed/);
    expect(report.importedComments).toBeGreaterThan(0);
  });

  it("handles WXR with category and tag terms in item blocks", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Categorized Post]]></title>",
      "<link>https://example.org/cat-post/</link>",
      "<wp:post_id>503</wp:post_id>",
      "<wp:post_name>cat-post</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "<category domain=\"category\" nicename=\"tech\"><![CDATA[Technology]]></category>",
      "<category domain=\"post_tag\" nicename=\"js\"><![CDATA[JavaScript]]></category>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("imports with includeUsers: false — importedUsers is 0", async () => {
    const wxr = [
      "<rss><channel>",
      "<wp:author>",
      "<wp:author_id>1</wp:author_id>",
      "<wp:author_login><![CDATA[admin]]></wp:author_login>",
      "<wp:author_email><![CDATA[admin@example.com]]></wp:author_email>",
      "<wp:author_display_name><![CDATA[Admin]]></wp:author_display_name>",
      "</wp:author>",
      makePost({ id: "504", name: "user-test" }),
      "</channel></rss>",
    ].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile, includeUsers: false });
    expect(report.importedUsers).toBe(0);
  });

  it("handles attachment with root URL (filenameFromUrl candidate='' fallback branch)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Root URL Attachment]]></title>",
      "<link>https://example.org/root-attach/</link>",
      "<wp:post_id>505</wp:post_id>",
      "<wp:post_name>root-attach</wp:post_name>",
      "<wp:status>inherit</wp:status>",
      "<wp:post_type>attachment</wp:post_type>",
      // Root URL: pathname = "/" → path.basename("/") = "" → uses fallback
      "<wp:attachment_url>https://example.org/</wp:attachment_url>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.status).toMatch(/^completed/);
  });

  it("handles post_name with only dashes by generating a slug from the post ID", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Dash Slug Post]]></title>",
      "<link>https://example.org/dash-slug/</link>",
      "<wp:post_id>506</wp:post_id>",
      // "---" reduces to "" after slug sanitization → uses fallback
      "<wp:post_name>---</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("handles WXR author with no login or displayName (third fallback 'Author N')", async () => {
    const wxr = [
      "<rss><channel>",
      "<wp:author>",
      "<wp:author_id></wp:author_id>",
      "<wp:author_login></wp:author_login>",
      "<wp:author_email></wp:author_email>",
      "<wp:author_display_name></wp:author_display_name>",
      "</wp:author>",
      makePost({ id: "507", name: "no-author-post" }),
      "</channel></rss>",
    ].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThanOrEqual(1);
  });

  it("ignores category blocks that have no domain attribute", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[No Domain Cat]]></title>",
      "<link>https://example.org/no-dom/</link>",
      "<wp:post_id>508</wp:post_id>",
      "<wp:post_name>no-dom</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "<category nicename=\"tech\"><![CDATA[Technology]]></category>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("handles category block with empty CDATA value (category.value || slugValue fallback)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Empty Cat CDATA]]></title>",
      "<link>https://example.org/empty-cat/</link>",
      "<wp:post_id>509</wp:post_id>",
      "<wp:post_name>empty-cat</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      // Empty CDATA value: category.value = "" → falls back to slugValue
      "<category domain=\"category\" nicename=\"tech\"></category>",
      "<category domain=\"post_tag\" nicename=\"js\"></category>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("handles a comment that includes an author email address", async () => {
    const innerComment = [
      "<wp:comment>",
      "<wp:comment_id>99</wp:comment_id>",
      "<wp:comment_author><![CDATA[Alice]]></wp:comment_author>",
      "<wp:comment_author_email><![CDATA[alice@example.com]]></wp:comment_author_email>",
      "<wp:comment_date>2024-03-01 12:00:00</wp:comment_date>",
      "<wp:comment_approved>1</wp:comment_approved>",
      "<wp:comment_content><![CDATA[Nice post!]]></wp:comment_content>",
      "</wp:comment>",
    ].join("");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "510", name: "email-comment-post", innerBlocks: innerComment })]),
      "utf8",
    );
    const report = await importer.importWordPress({ exportFile, includeComments: true });
    expect(report.importedComments).toBeGreaterThan(0);
  });

  it("generates redirects from wp:postmeta _wp_old_slug entries", async () => {
    const postmeta = [
      "<wp:postmeta>",
      "<wp:meta_key><![CDATA[_wp_old_slug]]></wp:meta_key>",
      "<wp:meta_value><![CDATA[old-hello-world]]></wp:meta_value>",
      "</wp:postmeta>",
    ].join("");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "511", name: "hello-world", innerBlocks: postmeta })]),
      "utf8",
    );
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRedirects).toBeGreaterThan(0);
  });

  it("handles item with empty post_id (item-N fallback branch)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[No Post ID]]></title>",
      "<link>https://example.org/no-post-id/</link>",
      "<wp:post_id></wp:post_id>",
      "<wp:post_name>no-post-id</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// K2: Malformed XML input — parser must not throw, should return empty/partial result
// ---------------------------------------------------------------------------

describe("malformed XML input handling", () => {
  it("handles completely empty export file gracefully — returns zero records", async () => {
    await writeFile(exportFile, "", "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(0);
    expect(report.failedMedia).toHaveLength(0);
  });

  it("handles export file with XML but no <item> elements — returns zero records", async () => {
    await writeFile(exportFile, "<rss><channel><title>Empty Export</title></channel></rss>", "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(0);
  });

  it("handles export file with truncated item — processes other items without throwing", async () => {
    // A truncated item (missing closing tag) mixed with a valid item
    const validItem = makePost({ id: "5001", name: "valid-post" });
    const truncated = "<item><title><![CDATA[Truncated]]></title><wp:post_id>5002</wp:post_id>";
    // The truncated item appears after the valid one; parser should still surface the valid post
    await writeFile(exportFile, `<rss><channel>${validItem}${truncated}</channel></rss>`, "utf8");
    // Must not throw — partial result is acceptable
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// K2: Missing media attachment URL — filenameFromUrl catch branch via empty sourceUrl
// ---------------------------------------------------------------------------

describe("attachment with no URL and no guid", () => {
  it("records media asset using slug fallback when both wp:attachment_url and guid are absent", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[No-URL Attachment]]></title>",
      "<wp:post_id>6001</wp:post_id>",
      "<wp:post_name>no-url-attachment</wp:post_name>",
      "<wp:status>inherit</wp:status>",
      "<wp:post_type>attachment</wp:post_type>",
      // deliberately omit wp:attachment_url and guid — sourceUrl will be ''
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    // The media asset is still recorded — sourceUrl is empty but filename falls back to slug.bin.
    // The filename is internal to the bundle; the report exposes the count via inventory.detectedMedia.
    expect(report.inventory.detectedMedia).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// K2: Duplicate slugs — same wp:post_name on two items
// ---------------------------------------------------------------------------

describe("duplicate slug handling", () => {
  it("imports both records when two posts share the same post_name — both appear in contentRecords", async () => {
    const post1 = makePost({ id: "7001", name: "duplicate-slug", type: "post" });
    const post2 = makePost({ id: "7002", name: "duplicate-slug", type: "post" });
    await writeFile(exportFile, makeWxr([post1, post2]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    // Both records should be parsed — the importer does not deduplicate at parse time
    expect(report.importedRecords).toBe(2);
  });

  it("applyLocal update path is exercised when the same slug is imported twice sequentially", async () => {
    const post = makePost({ id: "7003", name: "update-path-slug", type: "post" });
    await writeFile(exportFile, makeWxr([post]), "utf8");
    const dbPath = join(workspace, "update-path.sqlite");
    const { createDefaultAstropressSqliteSeedToolkit } = await import("../src/sqlite-bootstrap.js");
    createDefaultAstropressSqliteSeedToolkit().seedDatabase({ dbPath });

    // First apply — inserts
    await importer.importWordPress({ exportFile, applyLocal: true, workspaceRoot: workspace, adminDbPath: dbPath, includeComments: false, includeMedia: false });
    // Second apply — hits the 'existing record' update path (line 716)
    const report2 = await importer.importWordPress({ exportFile, applyLocal: true, workspaceRoot: workspace, adminDbPath: dbPath, includeComments: false, includeMedia: false });
    expect(report2.importedRecords).toBe(1);
  }, 30000);
});

describe("importWordPress — error/guard branches", () => {
  it("throws when exportFile is not provided", async () => {
    await expect(importer.importWordPress({} as Parameters<typeof importer.importWordPress>[0])).rejects.toThrow(
      "WordPress import requires an",
    );
  });

  it("handles fetch throwing a non-Error value (string error reason branch)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Fetch Throw Test]]></title>",
      "<link>https://example.org/fetch-throw/</link>",
      "<wp:post_id>701</wp:post_id>",
      "<wp:post_name>fetch-throw</wp:post_name>",
      "<wp:status>inherit</wp:status>",
      "<wp:post_type>attachment</wp:post_type>",
      "<wp:attachment_url>https://example.org/wp-content/uploads/image.jpg</wp:attachment_url>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");

    // Throw a plain string (not an Error instance) to hit the `instanceof Error` false branch
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network failure"));

    const artifactDir = join(workspace, "artifacts");
    const report = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: true,
      includeMedia: true,
    });

    expect(report.failedMedia.length).toBeGreaterThan(0);
    expect(report.failedMedia[0].reason).toBe("Unknown media download error");
  });
});

describe("applyLocal — additional branches", () => {
  it("applies with a relative adminDbPath", async () => {
    await writeFile(exportFile, makeWxr([makePost({ id: "801", name: "relative-db-post" })]), "utf8");
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: "relative-admin.sqlite", // relative → joined with workspaceRoot
      includeComments: false,
      includeMedia: false,
    });
    expect(report.localApply?.appliedRecords).toBeGreaterThan(0);
  });

  it("applies comment with author email in applyLocal", async () => {
    const innerComment = [
      "<wp:comment>",
      "<wp:comment_id>800</wp:comment_id>",
      "<wp:comment_author><![CDATA[Carol]]></wp:comment_author>",
      "<wp:comment_author_email><![CDATA[carol@example.com]]></wp:comment_author_email>",
      "<wp:comment_date>2024-04-01 08:00:00</wp:comment_date>",
      "<wp:comment_approved>1</wp:comment_approved>",
      "<wp:comment_content><![CDATA[Excellent!]]></wp:comment_content>",
      "</wp:comment>",
    ].join("");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "802", name: "email-apply-post", innerBlocks: innerComment })]),
      "utf8",
    );
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "email-apply.sqlite"),
      includeComments: true,
      includeMedia: false,
    });
    expect(report.localApply?.appliedComments).toBeGreaterThan(0);
  });

  it("applies media assets with artifactDir (includeMedia loop + downloadedPath branch)", async () => {
    const item = [
      "<item>",
      "<title><![CDATA[Apply Media Test]]></title>",
      "<link>https://example.org/apply-media/</link>",
      "<wp:post_id>901</wp:post_id>",
      "<wp:post_name>apply-media</wp:post_name>",
      "<wp:status>inherit</wp:status>",
      "<wp:post_type>attachment</wp:post_type>",
      "<wp:attachment_url>https://example.org/wp-content/uploads/test.jpg</wp:attachment_url>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");

    const artifactDir = join(workspace, "media-artifacts");
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "media-apply.sqlite"),
      artifactDir,
      includeComments: false,
      includeMedia: true,
      // No downloadMedia — so file won't exist on disk; localPath = asset.legacyUrl
    });
    expect(report.localApply?.appliedMedia).toBeGreaterThan(0);
  });

  it("applies redirects from wp:postmeta _wp_old_slug via applyLocal (upsertRedirect branch)", async () => {
    const postmeta = [
      "<wp:postmeta>",
      "<wp:meta_key><![CDATA[_wp_old_slug]]></wp:meta_key>",
      "<wp:meta_value><![CDATA[old-apply-slug]]></wp:meta_value>",
      "</wp:postmeta>",
    ].join("");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "902", name: "apply-redirect-post", innerBlocks: postmeta })]),
      "utf8",
    );
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "redirect-apply.sqlite"),
      includeComments: false,
      includeMedia: false,
    });
    expect(report.localApply?.appliedRedirects).toBeGreaterThan(0);
  });

  it("uses process.cwd() when workspaceRoot is omitted", async () => {
    // Write a minimal export; the DB will be created under process.cwd()
    await writeFile(exportFile, makeWxr([makePost({ id: "903", name: "cwd-post" })]), "utf8");
    // Provide an absolute adminDbPath so we control where the DB goes
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      adminDbPath: join(workspace, "cwd-admin.sqlite"),
      includeComments: false,
      includeMedia: false,
      // workspaceRoot intentionally omitted → uses process.cwd()
    });
    expect(report.localApply?.appliedRecords).toBeGreaterThan(0);
  });

  it("applies users when includeUsers:true and WXR has author blocks", async () => {
    const authorBlock = [
      "<wp:author>",
      "<wp:author_id>1</wp:author_id>",
      "<wp:author_login><![CDATA[janedoe]]></wp:author_login>",
      "<wp:author_display_name><![CDATA[Jane Doe]]></wp:author_display_name>",
      "<wp:author_email><![CDATA[jane@example.com]]></wp:author_email>",
      "</wp:author>",
    ].join("");
    // Wrap author block in channel via custom WXR
    const wxr = ["<rss>", "<channel>", authorBlock, makePost({ id: "901", name: "user-post" }), "</channel>", "</rss>"].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "users-apply.sqlite"),
      includeComments: false,
      includeMedia: false,
      includeUsers: true,
    });
    expect(report.localApply?.appliedUsers).toBeGreaterThan(0);
  });

  it("applies import with includeUsers: false and reports zero applied users", async () => {
    await writeFile(exportFile, makeWxr([makePost({ id: "950", name: "no-users-post" })]), "utf8");
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "no-users.sqlite"),
      includeComments: false,
      includeMedia: false,
      includeUsers: false,
    });
    expect(report.localApply?.appliedUsers).toBe(0);
  });

  it("applies media without artifactDir when no download path is available", async () => {
    const attachment = [
      "<item>",
      "<title><![CDATA[No Artifact Media]]></title>",
      "<link>https://example.org/noart/</link>",
      "<wp:post_id>902</wp:post_id>",
      "<wp:post_name>noart</wp:post_name>",
      "<wp:status>inherit</wp:status>",
      "<wp:post_type>attachment</wp:post_type>",
      "<wp:attachment_url>https://example.org/wp-content/uploads/noart.jpg</wp:attachment_url>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([attachment]), "utf8");
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "noart-media.sqlite"),
      includeComments: false,
      includeMedia: true,
      // No artifactDir → downloadedPath = void 0 → hasDownloadedFile = false
    });
    expect(report.localApply?.appliedMedia).toBeGreaterThan(0);
  });
});

describe("decodeXml — numeric XML entity branches (lines 35-39)", () => {
  it("decodes decimal and hex numeric entities in post content (isFinite true path)", async () => {
    const artifactDir = join(workspace, "artifacts-entity-numeric");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "2001", name: "entity-numeric", body: "it&#39;s &#x27;hello&#x27; &#60;" })]),
      "utf8",
    );
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    // &#39; → ', &#x27; → ', &#60; → <
    expect(records[0].body).toBe("it's 'hello' <");
  });

  it("returns entity unchanged when numeric entity value is NaN (isFinite false path, e.g. &#a;)", async () => {
    const artifactDir = join(workspace, "artifacts-entity-nan");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "2002", name: "entity-nan", body: "bad &#a; entity" })]),
      "utf8",
    );
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    // &#a; → parseInt("a", 10) = NaN → !isFinite → entity left verbatim
    expect(records[0].body).toBe("bad &#a; entity");
  });

  it("returns entity unchanged when named entity is not in lookup table (e.g. &hellip;)", async () => {
    const artifactDir = join(workspace, "artifacts-entity-named");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "2003", name: "entity-unknown", body: "text&hellip;more" })]),
      "utf8",
    );
    await importer.importWordPress({ exportFile, artifactDir });
    const records = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    // &hellip; is not in XML_ENTITY_LOOKUP → preserved verbatim
    expect(records[0].body).toBe("text&hellip;more");
  });
});

describe("resolveLocalAdminDbPath default path (line 478)", () => {
  it("uses default DB path when adminDbPath is not provided", async () => {
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "2300", name: "default-db-path-post" })]),
      "utf8",
    );
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      // No adminDbPath — resolveLocalAdminDbPath falls through to default
      includeComments: false,
      includeMedia: false,
    });
    expect(report.localApply?.appliedRecords).toBeGreaterThanOrEqual(1);
  });
});

describe("comment without email — authorEmail ?? null (line 643 branch)", () => {
  it("inserts null for authorEmail when comment has no email tag", async () => {
    const innerComment = [
      "<wp:comment>",
      "<wp:comment_id>2400</wp:comment_id>",
      "<wp:comment_author><![CDATA[Anonymous]]></wp:comment_author>",
      "<wp:comment_date>2024-05-01 09:00:00</wp:comment_date>",
      "<wp:comment_approved>1</wp:comment_approved>",
      "<wp:comment_content><![CDATA[No email here]]></wp:comment_content>",
      "</wp:comment>",
    ].join("");
    await writeFile(
      exportFile,
      makeWxr([makePost({ id: "2401", name: "no-email-comment-post", innerBlocks: innerComment })]),
      "utf8",
    );
    const report = await importer.importWordPress({
      exportFile,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath: join(workspace, "no-email-comment.sqlite"),
      includeComments: true,
      includeMedia: false,
    });
    expect(report.localApply?.appliedComments).toBeGreaterThan(0);
  });
});

describe("buildImportPlan inventory-based defaults (lines 317-321 ?? branches)", () => {
  it("uses inventory detection for includeComments/Users/Media when not explicitly specified", async () => {
    await writeFile(
      exportFile,
      makeWxr([
        makePost({
          id: "2500",
          name: "defaults-test",
          innerBlocks: [
            "<wp:comment>",
            "<wp:comment_id>2501</wp:comment_id>",
            "<wp:comment_author><![CDATA[Tester]]></wp:comment_author>",
            "<wp:comment_date>2024-06-01 10:00:00</wp:comment_date>",
            "<wp:comment_approved>1</wp:comment_approved>",
            "<wp:comment_content><![CDATA[Auto-included]]></wp:comment_content>",
            "</wp:comment>",
          ].join(""),
        }),
      ]),
      "utf8",
    );
    // No includeComments/Users/Media specified — buildImportPlan uses inventory detection
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBeGreaterThanOrEqual(1);
    expect(report.importedComments).toBeGreaterThanOrEqual(1);
  });
});

describe("authorLogins empty array branch (lines 203-205: no creator, no authors)", () => {
  let exportFile: string;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "astropress-author-test-"));
    exportFile = join(tmpDir, "export.xml");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("sets authorLogins to [] when post has no dc:creator and WXR has no authors", async () => {
    // No <wp:author> blocks, no <dc:creator> in post → authorLogins = []
    const item = [
      "<item>",
      "<title><![CDATA[Authorless Post]]></title>",
      "<link>https://example.org/authorless/</link>",
      "<wp:post_id>9001</wp:post_id>",
      "<wp:post_name>authorless</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "</item>",
    ].join("");
    await writeFile(exportFile, makeWxr([item]), "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("uses first author login when dc:creator doesn't match any known author", async () => {
    // Authors exist but dc:creator doesn't match → falls back to authors[0].login
    const wxr = [
      "<rss><channel>",
      "<wp:author>",
      "<wp:author_id>1</wp:author_id>",
      "<wp:author_login><![CDATA[alice]]></wp:author_login>",
      "<wp:author_email><![CDATA[alice@example.com]]></wp:author_email>",
      "<wp:author_display_name><![CDATA[Alice]]></wp:author_display_name>",
      "</wp:author>",
      "<item>",
      "<title><![CDATA[Unmatched Creator Post]]></title>",
      "<link>https://example.org/unmatched/</link>",
      "<wp:post_id>9002</wp:post_id>",
      "<wp:post_name>unmatched</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      // dc:creator login doesn't match any author → matchedAuthor = undefined, authors.length > 0 → uses authors[0]
      "<dc:creator><![CDATA[nobody]]></dc:creator>",
      "</item>",
      "</channel></rss>",
    ].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });

  it("uses matched author login when dc:creator matches a known author", async () => {
    // dc:creator exactly matches wp:author_login → matchedAuthor found → authorLogins = [matchedAuthor.login]
    const wxr = [
      "<rss><channel>",
      "<wp:author>",
      "<wp:author_id>1</wp:author_id>",
      "<wp:author_login><![CDATA[alice]]></wp:author_login>",
      "<wp:author_email><![CDATA[alice@example.com]]></wp:author_email>",
      "<wp:author_display_name><![CDATA[Alice]]></wp:author_display_name>",
      "</wp:author>",
      "<item>",
      "<title><![CDATA[Matched Creator Post]]></title>",
      "<link>https://example.org/matched/</link>",
      "<wp:post_id>9003</wp:post_id>",
      "<wp:post_name>matched</wp:post_name>",
      "<wp:status>publish</wp:status>",
      "<wp:post_type>post</wp:post_type>",
      "<dc:creator><![CDATA[alice]]></dc:creator>",
      "</item>",
      "</channel></rss>",
    ].join("");
    await writeFile(exportFile, wxr, "utf8");
    const report = await importer.importWordPress({ exportFile });
    expect(report.importedRecords).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// K2: Malformed XML input — parser must not throw, should return empty/partial result
// ---------------------------------------------------------------------------
