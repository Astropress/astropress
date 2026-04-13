import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { createAstropressWordPressImportSource } from "../src/import/wordpress.js";

describe("wordpress import contract", () => {
  it("parses WXR content into staged import artifacts and redirects", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-wordpress-import-"));
    const artifactDir = join(workspace, "artifacts");
    const exportFile = join(workspace, "export.xml");
    await writeFile(
      exportFile,
      [
        "<rss>",
        "<channel>",
        "<wp:author>",
        "<wp:author_id>7</wp:author_id>",
        "<wp:author_login><![CDATA[admin]]></wp:author_login>",
        "<wp:author_email><![CDATA[admin@example.org]]></wp:author_email>",
        "<wp:author_display_name><![CDATA[Admin Person]]></wp:author_display_name>",
        "</wp:author>",
        "<item>",
        "<title><![CDATA[Hello World]]></title>",
        "<link>https://example.org/blog/hello-world/</link>",
        "<content:encoded><![CDATA[<p>Intro</p>[gallery ids=\"1,2\"]]]></content:encoded>",
        "<excerpt:encoded><![CDATA[A short summary]]></excerpt:encoded>",
        "<wp:post_id>101</wp:post_id>",
        "<wp:post_date>2024-01-01 12:00:00</wp:post_date>",
        "<wp:post_name>hello-world</wp:post_name>",
        "<wp:status>publish</wp:status>",
        "<wp:post_type>post</wp:post_type>",
        "<category domain=\"category\" nicename=\"news\"><![CDATA[News]]></category>",
        "<category domain=\"post_tag\" nicename=\"featured\"><![CDATA[Featured]]></category>",
        "<wp:postmeta><wp:meta_key>_wp_old_slug</wp:meta_key><wp:meta_value>hello-old</wp:meta_value></wp:postmeta>",
        "<wp:comment><wp:comment_id>1</wp:comment_id><wp:comment_author><![CDATA[Pat Reader]]></wp:comment_author><wp:comment_author_email><![CDATA[pat@example.org]]></wp:comment_author_email><wp:comment_date>2024-01-02 10:00:00</wp:comment_date><wp:comment_approved>1</wp:comment_approved><wp:comment_content><![CDATA[Nice post]]></wp:comment_content></wp:comment>",
        "</item>",
        "<item>",
        "<title><![CDATA[About]]></title>",
        "<link>https://example.org/about/</link>",
        "<content:encoded><![CDATA[<p>About us</p>]]></content:encoded>",
        "<wp:post_id>102</wp:post_id>",
        "<wp:post_name>about</wp:post_name>",
        "<wp:status>draft</wp:status>",
        "<wp:post_type>page</wp:post_type>",
        "</item>",
        "<item>",
        "<title><![CDATA[Hero Image]]></title>",
        "<link>https://example.org/wp-content/uploads/2024/01/hero.png</link>",
        "<wp:post_id>201</wp:post_id>",
        "<wp:post_name>hero-image</wp:post_name>",
        "<wp:status>inherit</wp:status>",
        "<wp:post_type>attachment</wp:post_type>",
        "<wp:post_parent>101</wp:post_parent>",
        "<wp:attachment_url>data:text/plain;base64,aGVsbG8=</wp:attachment_url>",
        "</item>",
        "</channel>",
        "</rss>",
      ].join(""),
      "utf8",
    );

    const importer = createAstropressWordPressImportSource();
    const inventory = await importer.inspectWordPress?.({ exportFile });
    const plan = await importer.planWordPressImport?.({
      inventory: inventory!,
      downloadMedia: true,
      artifactDir,
    });
    const report = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: true,
      plan,
    });

    expect(inventory).toMatchObject({
      exportFile,
      detectedRecords: 3,
      detectedMedia: 1,
      detectedComments: 1,
      detectedUsers: 1,
      detectedShortcodes: 1,
      entityCounts: {
        posts: 1,
        pages: 1,
        attachments: 1,
        redirects: 1,
        comments: 1,
        users: 1,
        categories: 1,
        tags: 1,
      },
      remediationCandidates: ["post-101"],
    });
    expect(plan).toMatchObject({
      artifactDir,
      downloadMedia: true,
      resumeSupported: true,
      permalinkStrategy: "preserve-wordpress-links",
      entityCounts: {
        redirects: 1,
      },
    });
    expect(report).toMatchObject({
      status: "completed_with_warnings",
      importedRecords: 2,
      importedMedia: 1,
      importedComments: 1,
      importedUsers: 1,
      importedRedirects: 1,
      downloadedMedia: 1,
      artifacts: {
        artifactDir,
      },
    });

    const contentRecords = JSON.parse(await readFile(join(artifactDir, "content-records.json"), "utf8")) as Array<Record<string, unknown>>;
    const redirectRecords = JSON.parse(await readFile(join(artifactDir, "redirect-records.json"), "utf8")) as Array<Record<string, unknown>>;
    const mediaManifest = JSON.parse(await readFile(join(artifactDir, "media-manifest.json"), "utf8")) as Array<Record<string, unknown>>;
    const downloadState = JSON.parse(await readFile(join(artifactDir, "download-state.json"), "utf8")) as { completed: string[]; failed: unknown[] };

    expect(contentRecords).toHaveLength(2);
    expect(contentRecords[0]).toMatchObject({
      id: "post-101",
      slug: "hello-world",
      legacyUrl: "/blog/hello-world/",
      categorySlugs: ["news"],
      tagSlugs: ["featured"],
    });
    expect(redirectRecords).toEqual([
      expect.objectContaining({
        sourcePath: "/blog/hello-old/",
        targetPath: "/blog/hello-world/",
      }),
    ]);
    expect(mediaManifest).toEqual([
      expect.objectContaining({
        id: "media-201",
        parentLegacyId: "101",
      }),
    ]);
    expect(downloadState.completed).toContain("media-201");
    expect(downloadState.failed).toEqual([]);

    const importReport = JSON.parse(await readFile(join(artifactDir, "import-report.json"), "utf8")) as Record<string, unknown>;
    expect(importReport).toMatchObject({ counts: { posts: 1 }, mediaErrors: [] });
    expect(importReport.status === "completed" || importReport.status === "completed_with_warnings").toBe(true);

    const resumed = await importer.resumeWordPressImport?.({
      exportFile,
      artifactDir,
      downloadMedia: true,
    });
    expect(resumed?.downloadedMedia).toBe(0);
    expect(resumed?.artifacts?.downloadStateFile).toBe(join(artifactDir, "download-state.json"));

    await rm(workspace, { recursive: true, force: true });
  });

  it("can apply staged imports into the local sqlite runtime idempotently", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-wordpress-apply-"));
    const artifactDir = join(workspace, "artifacts");
    const adminDbPath = join(workspace, ".data", "admin.sqlite");
    const exportFile = join(workspace, "export.xml");
    await writeFile(
      exportFile,
      [
        "<rss>",
        "<channel>",
        "<wp:author><wp:author_id>7</wp:author_id><wp:author_login><![CDATA[admin]]></wp:author_login><wp:author_display_name><![CDATA[Admin Person]]></wp:author_display_name></wp:author>",
        "<item><title><![CDATA[Hello World]]></title><link>https://example.org/blog/hello-world/</link><content:encoded><![CDATA[<p>Intro</p>]]></content:encoded><excerpt:encoded><![CDATA[A short summary]]></excerpt:encoded><wp:post_id>101</wp:post_id><wp:post_name>hello-world</wp:post_name><wp:status>publish</wp:status><wp:post_type>post</wp:post_type><category domain=\"category\" nicename=\"news\"><![CDATA[News]]></category><category domain=\"post_tag\" nicename=\"featured\"><![CDATA[Featured]]></category><wp:postmeta><wp:meta_key>_wp_old_slug</wp:meta_key><wp:meta_value>hello-old</wp:meta_value></wp:postmeta><wp:comment><wp:comment_id>1</wp:comment_id><wp:comment_author><![CDATA[Pat Reader]]></wp:comment_author><wp:comment_content><![CDATA[Nice post]]></wp:comment_content><wp:comment_approved>1</wp:comment_approved></wp:comment></item>",
        "<item><title><![CDATA[Hero Image]]></title><link>https://example.org/wp-content/uploads/2024/01/hero.png</link><wp:post_id>201</wp:post_id><wp:post_name>hero-image</wp:post_name><wp:status>inherit</wp:status><wp:post_type>attachment</wp:post_type><wp:post_parent>101</wp:post_parent><wp:attachment_url>data:text/plain;base64,aGVsbG8=</wp:attachment_url></item>",
        "</channel>",
        "</rss>",
      ].join(""),
      "utf8",
    );

    const importer = createAstropressWordPressImportSource();
    const first = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: true,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath,
    });
    const second = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: true,
      applyLocal: true,
      workspaceRoot: workspace,
      adminDbPath,
    });

    expect(first.localApply).toMatchObject({
      runtime: "sqlite-local",
      adminDbPath,
      appliedRecords: 1,
      appliedMedia: 1,
      appliedComments: 1,
      appliedUsers: 1,
      appliedRedirects: 1,
    });
    expect(second.localApply?.adminDbPath).toBe(adminDbPath);
    expect(first.artifacts?.localApplyReportFile).toBe(join(artifactDir, "wordpress.local-apply.json"));

    const db = new DatabaseSync(adminDbPath);
    expect((db.prepare("SELECT COUNT(*) AS count FROM content_entries").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM authors WHERE deleted_at IS NULL").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM categories WHERE deleted_at IS NULL").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM tags WHERE deleted_at IS NULL").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM comments").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM media_assets WHERE deleted_at IS NULL").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM redirect_rules WHERE deleted_at IS NULL").get() as { count: number }).count).toBe(1);
    db.close();

    await rm(workspace, { recursive: true, force: true });
  });

  it("skips local apply when applyLocal is false", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-wordpress-noapply-"));
    const artifactDir = join(workspace, "artifacts");
    const exportFile = join(workspace, "export.xml");
    await writeFile(
      exportFile,
      [
        "<rss><channel>",
        "<item><title><![CDATA[Hello]]></title><link>https://example.org/blog/hello/</link><content:encoded><![CDATA[<p>Hi</p>]]></content:encoded><wp:post_id>1</wp:post_id><wp:post_name>hello</wp:post_name><wp:status>publish</wp:status><wp:post_type>post</wp:post_type></item>",
        "</channel></rss>",
      ].join(""),
      "utf8",
    );

    const importer = createAstropressWordPressImportSource();
    const report = await importer.importWordPress({
      exportFile,
      artifactDir,
      downloadMedia: false,
      applyLocal: false,
    });

    // localApply must be undefined when applyLocal: false
    expect(report.localApply).toBeUndefined();
    expect(report.importedRecords).toBe(1);

    await rm(workspace, { recursive: true, force: true });
  });

});
