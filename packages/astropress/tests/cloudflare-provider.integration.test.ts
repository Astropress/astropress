import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";
import { createAstropressCloudflareAdapter, registerCms } from "astropress";
import { SqliteBackedD1Database, createSeededCloudflareDatabase } from "./helpers/provider-test-fixtures.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";

describe("cloudflare provider integration", () => {
  it("creates a D1-backed Cloudflare adapter surface", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
    });

    const db = await createSeededCloudflareDatabase();
    const cloudflare = createAstropressCloudflareAdapter({
      db: new SqliteBackedD1Database(db),
    });

    expect(cloudflare.capabilities.name).toBe("cloudflare");
    expect(cloudflare.capabilities.database).toBe(true);
    expect(cloudflare.capabilities.objectStorage).toBe(true);

    const user = await cloudflare.auth.signIn("admin@example.com", "password");
    expect(user?.role).toBe("admin");
    expect(user?.id).toHaveLength(36);
    const storedSession = db.prepare("SELECT id FROM admin_sessions LIMIT 1").get() as { id: string };
    expect(storedSession.id).not.toBe(user?.id);
    expect(await cloudflare.auth.getSession(user!.id)).toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });
    expect(await cloudflare.content.get("cloudflare-post")).toMatchObject({
      slug: "cloudflare-post",
      kind: "post",
      title: "Cloudflare post",
    });
    expect(await cloudflare.media.get("cloudflare-media-1")).toMatchObject({
      id: "cloudflare-media-1",
      mimeType: "image/png",
    });
    expect(await cloudflare.revisions.list("cloudflare-post")).toMatchObject([
      {
        id: "revision-cloudflare-1",
        recordId: "cloudflare-post",
      },
    ]);
    await cloudflare.auth.signOut(user!.id);
    expect(await cloudflare.auth.getSession(user!.id)).toBeNull();

    db.close();
  });

  it("persists writable records through the D1-backed Cloudflare adapter", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
    });

    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    const cloudflare = createAstropressCloudflareAdapter({
      db: new SqliteBackedD1Database(db),
    });

    const savedPost = await cloudflare.content.save({
      id: "cloudflare-write-post",
      kind: "post",
      slug: "cloudflare-write-post",
      status: "published",
      title: "Cloudflare write post",
      body: "<p>Writable Cloudflare body</p>",
      metadata: {
        metaDescription: "Writable Cloudflare record",
        seoTitle: "Cloudflare write post",
        legacyUrl: "/cloudflare-write-post",
      },
    });
    expect(savedPost.slug).toBe("cloudflare-write-post");
    expect(await cloudflare.content.get("cloudflare-write-post")).toMatchObject({
      slug: "cloudflare-write-post",
      kind: "post",
      title: "Cloudflare write post",
    });

    const translation = await cloudflare.content.save({
      id: "/es/cloudflare-write-post",
      kind: "translation",
      slug: "/es/cloudflare-write-post",
      status: "draft",
      metadata: {
        state: "translated",
      },
    });
    expect(translation.metadata).toMatchObject({
      state: "translated",
    });

    const redirect = await cloudflare.content.save({
      id: "/legacy-cloudflare-write-post",
      kind: "redirect",
      slug: "/legacy-cloudflare-write-post",
      status: "published",
      metadata: {
        targetPath: "/cloudflare-write-post",
        statusCode: 301,
      },
    });
    expect(redirect.metadata).toMatchObject({
      targetPath: "/cloudflare-write-post",
      statusCode: 301,
    });

    const settings = await cloudflare.content.save({
      id: "site-settings",
      kind: "settings",
      slug: "site-settings",
      status: "published",
      metadata: {
        siteTitle: "Cloudflare Writable Site",
      },
    });
    expect(settings.title).toBe("Cloudflare Writable Site");

    await cloudflare.media.put({
      id: "cloudflare-upload",
      filename: "cloudflare-upload.png",
      mimeType: "image/png",
      publicUrl: "https://cdn.example.com/cloudflare-upload.png",
      metadata: {
        altText: "Cloudflare upload",
        title: "cloudflare-upload.png",
      },
    });
    expect(await cloudflare.media.get("cloudflare-upload")).toMatchObject({
      id: "cloudflare-upload",
      mimeType: "image/png",
    });

    await cloudflare.revisions.append({
      id: "cloudflare-write-revision",
      recordId: "cloudflare-write-post",
      createdAt: "2026-01-01T00:00:00.000Z",
      actorId: "admin@example.com",
      summary: "Cloudflare write revision",
      snapshot: {
        title: "Cloudflare write post",
        status: "published",
        body: "<p>Writable Cloudflare body</p>",
        seoTitle: "Cloudflare write post",
        metaDescription: "Writable Cloudflare record",
      },
    });
    expect(await cloudflare.revisions.list("cloudflare-write-post")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cloudflare-write-revision",
          recordId: "cloudflare-write-post",
        }),
      ]),
    );

    await cloudflare.content.delete("/legacy-cloudflare-write-post");
    await cloudflare.media.delete("cloudflare-upload");

    expect(await cloudflare.content.get("/legacy-cloudflare-write-post")).toBeNull();
    expect(await cloudflare.media.get("cloudflare-upload")).toBeNull();

    db.close();
  });
});
