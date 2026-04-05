import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  createAstropressHostedPlatformAdapter,
  createAstropressCloudflareAdapter,
  createAstropressHostedAdapter,
  createAstropressRunwayAdapter,
  createAstropressRunwayHostedAdapter,
  createAstropressSupabaseAdapter,
  createAstropressSupabaseHostedAdapter,
  resolveAstropressHostedProvider,
  readAstropressRunwayHostedConfig,
  readAstropressSupabaseHostedConfig,
  registerCms,
} from "astropress";
import { createAstropressRunwaySqliteAdapter } from "../src/adapters/runway-sqlite.js";
import { createAstropressLocalAdapter } from "../src/adapters/local.js";
import { createAstropressSqliteAdapter } from "../src/adapters/sqlite.js";
import { createAstropressSupabaseSqliteAdapter } from "../src/adapters/supabase-sqlite.js";
import { createAstropressGitHubPagesDeployTarget } from "../src/deploy/github-pages.js";
import { createAstropressWordPressImportSource } from "../src/import/wordpress.js";
import { createAstropressGitSyncAdapter } from "../src/sync/git.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from "../src/d1-database";

class SqliteD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1PreparedStatement(this.db, this.sql, values);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    if (columnName) {
      return ((row[columnName] ?? null) as T) ?? null;
    }

    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { success: true, results };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [] };
  }
}

class SqliteBackedD1Database implements D1DatabaseLike {
  constructor(private readonly db: DatabaseSync) {}

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.db, query);
  }
}

describe("provider adapters", () => {
  it("creates first-party adapters with provider-specific capability defaults", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-sqlite-adapter-"));
    const sqlite = createAstropressSqliteAdapter({
      workspaceRoot: workspace,
      dbPath: join(workspace, "admin.sqlite"),
    });
    const cloudflare = createAstropressCloudflareAdapter();
    const supabase = createAstropressSupabaseAdapter();
    const runway = createAstropressRunwayAdapter();

    expect(sqlite.capabilities.name).toBe("sqlite");
    expect(sqlite.capabilities.database).toBe(true);
    expect(cloudflare.capabilities.objectStorage).toBe(true);
    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.serverRuntime).toBe(true);

    const user = await sqlite.auth.signIn("admin@example.com", "password");
    expect(user?.role).toBe("admin");
    expect(user?.id).toBeTruthy();
    expect(await sqlite.auth.getSession(user?.id ?? "")).toEqual(user);

    const savedRecord = await sqlite.content.save({
      id: "hello-world",
      kind: "post",
      slug: "hello-world",
      status: "published",
      title: "Hello world",
      body: "Astropress SQLite adapter",
      metadata: {
        metaDescription: "Adapter-backed post",
        seoTitle: "Hello world",
        legacyUrl: "/hello-world",
      },
    });
    expect(savedRecord.kind).toBe("post");
    expect(await sqlite.content.get("hello-world")).toMatchObject({
      slug: "hello-world",
      kind: "post",
    });
    expect((await sqlite.content.list("post")).some((record) => record.slug === "hello-world")).toBe(true);

    await rm(workspace, { recursive: true, force: true });
  });

  it("lets Supabase and Runway wrap a real backing adapter surface", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-provider-wrap-"));
    const backingAdapter = createAstropressSqliteAdapter({
      workspaceRoot: workspace,
      dbPath: join(workspace, "admin.sqlite"),
    });
    const supabase = createAstropressSupabaseAdapter({ backingAdapter });
    const runway = createAstropressRunwayAdapter({ backingAdapter });

    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.name).toBe("runway");
    expect(runway.capabilities.serverRuntime).toBe(true);

    const saved = await runway.content.save({
      id: "wrapped-post",
      kind: "post",
      slug: "wrapped-post",
      status: "published",
      title: "Wrapped post",
      body: "Runway-backed content",
      metadata: {
        metaDescription: "Wrapped provider",
        seoTitle: "Wrapped post",
        legacyUrl: "/wrapped-post",
      },
    });

    expect(saved.slug).toBe("wrapped-post");
    expect(await supabase.content.get("wrapped-post")).toMatchObject({
      slug: "wrapped-post",
      kind: "post",
    });

    await rm(workspace, { recursive: true, force: true });
  });

  it("lets Supabase and Runway use explicit hosted store modules", async () => {
    const contentRecords = new Map<string, { id: string; slug: string; title: string }>();
    const supabaseHosted = createAstropressHostedPlatformAdapter({
      providerName: "supabase",
      content: {
        async list() {
          return [...contentRecords.values()].map((record) => ({
            id: record.id,
            kind: "post" as const,
            slug: record.slug,
            status: "published" as const,
            title: record.title,
          }));
        },
        async get(id) {
          const record = contentRecords.get(id);
          return record
            ? {
                id: record.id,
                kind: "post" as const,
                slug: record.slug,
                status: "published" as const,
                title: record.title,
              }
            : null;
        },
        async save(record) {
          contentRecords.set(record.id, {
            id: record.id,
            slug: record.slug,
            title: String(record.title ?? record.id),
          });
          return record;
        },
        async delete(id) {
          contentRecords.delete(id);
        },
      },
      media: {
        async put(asset) {
          return asset;
        },
        async get() {
          return null;
        },
        async delete() {},
      },
      revisions: {
        async list() {
          return [];
        },
        async append(revision) {
          return revision;
        },
      },
      auth: {
        async signIn(email) {
          return { id: "remote-session", email, role: "admin" as const };
        },
        async signOut() {},
        async getSession(sessionId) {
          return { id: sessionId, email: "admin@example.com", role: "admin" as const };
        },
      },
    });
    const supabase = createAstropressSupabaseAdapter({
      backingAdapter: supabaseHosted,
    });
    const runway = createAstropressRunwayAdapter({
      backingAdapter: supabaseHosted,
    });

    await supabase.content.save({
      id: "hosted-remote-post",
      kind: "post",
      slug: "hosted-remote-post",
      status: "published",
      title: "Hosted remote post",
    });

    expect(await runway.content.get("hosted-remote-post")).toMatchObject({
      slug: "hosted-remote-post",
      title: "Hosted remote post",
    });
    expect(await supabase.auth.signIn("admin@example.com", "password")).toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });
    expect(runway.capabilities.name).toBe("runway");
  });

  it("creates sqlite-backed local runtimes for Supabase and Runway", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-provider-sqlite-"));
    const supabase = createAstropressSupabaseSqliteAdapter({
      workspaceRoot: workspace,
      dbPath: join(workspace, "supabase-admin.sqlite"),
    });
    const runway = createAstropressRunwaySqliteAdapter({
      workspaceRoot: workspace,
      dbPath: join(workspace, "runway-admin.sqlite"),
    });

    const supabaseUser = await supabase.auth.signIn("admin@example.com", "password");
    const runwayUser = await runway.auth.signIn("admin@example.com", "password");
    expect(supabaseUser?.role).toBe("admin");
    expect(runwayUser?.role).toBe("admin");

    const saved = await supabase.content.save({
      id: "provider-local-post",
      kind: "post",
      slug: "provider-local-post",
      status: "published",
      title: "Provider local post",
      body: "Supabase local runtime",
      metadata: {
        metaDescription: "Provider local runtime",
        seoTitle: "Provider local post",
        legacyUrl: "/provider-local-post",
      },
    });
    expect(saved.slug).toBe("provider-local-post");
    expect(await supabase.content.get("provider-local-post")).toMatchObject({
      slug: "provider-local-post",
    });

    const runwaySaved = await runway.content.save({
      id: "runway-local-post",
      kind: "post",
      slug: "runway-local-post",
      status: "published",
      title: "Runway local post",
      body: "Runway local runtime",
      metadata: {
        metaDescription: "Runway local runtime",
        seoTitle: "Runway local post",
        legacyUrl: "/runway-local-post",
      },
    });
    expect(runwaySaved.slug).toBe("runway-local-post");
    expect(await runway.content.get("runway-local-post")).toMatchObject({
      slug: "runway-local-post",
    });

    await rm(workspace, { recursive: true, force: true });
  });

  it("reads hosted provider config from env maps", () => {
    expect(
      readAstropressSupabaseHostedConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service",
    });
    expect(
      readAstropressRunwayHostedConfig({
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "project-123",
      }),
    ).toEqual({
      apiToken: "token",
      projectId: "project-123",
    });
  });

  it("guards hosted provider config and builds hosted adapters with preview URLs", async () => {
    expect(() => readAstropressSupabaseHostedConfig({})).toThrow(/SUPABASE_URL/);
    expect(() => readAstropressRunwayHostedConfig({})).toThrow(/RUNWAY_API_TOKEN/);

    const contentRecords = new Map<string, { id: string; slug: string; title: string }>();
    const hostedStores = {
      content: {
        async list() {
          return [...contentRecords.values()].map((record) => ({
            id: record.id,
            kind: "post" as const,
            slug: record.slug,
            status: "published" as const,
            title: record.title,
          }));
        },
        async get(id: string) {
          const record = contentRecords.get(id);
          return record
            ? {
                id: record.id,
                kind: "post" as const,
                slug: record.slug,
                status: "published" as const,
                title: record.title,
              }
            : null;
        },
        async save(record: { id: string; slug: string; title?: string | null }) {
          contentRecords.set(record.id, {
            id: record.id,
            slug: record.slug,
            title: String(record.title ?? record.id),
          });
          return {
            ...record,
            kind: "post" as const,
            status: "published" as const,
          };
        },
        async delete(id: string) {
          contentRecords.delete(id);
        },
      },
      media: {
        async put(asset: { id: string; filename: string; mimeType: string }) {
          return asset;
        },
        async get() {
          return null;
        },
        async delete() {},
      },
      revisions: {
        async list() {
          return [];
        },
        async append(revision: { id: string; recordId: string; createdAt: string; snapshot: Record<string, unknown> }) {
          return revision;
        },
      },
      auth: {
        async signIn(email: string) {
          return { id: "hosted-session", email, role: "admin" as const };
        },
        async signOut() {},
        async getSession(sessionId: string) {
          return { id: sessionId, email: "admin@example.com", role: "admin" as const };
        },
      },
    };

    const supabase = createAstropressSupabaseHostedAdapter({
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      ...hostedStores,
    });
    const runway = createAstropressRunwayHostedAdapter({
      env: {
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "project-123",
      },
      ...hostedStores,
    });

    await supabase.content.save({
      id: "hosted-config-post",
      kind: "post",
      slug: "hosted-config-post",
      status: "published",
      title: "Hosted config post",
    });

    expect(await runway.content.get("hosted-config-post")).toMatchObject({
      slug: "hosted-config-post",
    });
    expect(await supabase.preview?.create({ recordId: "hosted-config-post" })).toEqual({
      url: "https://example.supabase.co/preview",
    });
    expect(await runway.preview?.create({ recordId: "hosted-config-post" })).toEqual({
      url: "https://runway.example/project-123/preview",
    });
  });

  it("selects hosted providers from explicit options or env", async () => {
    expect(resolveAstropressHostedProvider(undefined)).toBe("supabase");
    expect(resolveAstropressHostedProvider("runway")).toBe("runway");
    expect(resolveAstropressHostedProvider("unexpected")).toBe("supabase");

    const supabase = createAstropressHostedAdapter({
      env: {
        SUPABASE_URL: "https://selector.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      content: {
        async list() {
          return [];
        },
        async get() {
          return null;
        },
        async save(record) {
          return record;
        },
        async delete() {},
      },
      media: {
        async put(asset) {
          return asset;
        },
        async get() {
          return null;
        },
        async delete() {},
      },
      revisions: {
        async list() {
          return [];
        },
        async append(revision) {
          return revision;
        },
      },
      auth: {
        async signIn(email) {
          return { id: "selector-session", email, role: "admin" as const };
        },
        async signOut() {},
        async getSession(sessionId) {
          return { id: sessionId, email: "admin@example.com", role: "admin" as const };
        },
      },
    });

    const runway = createAstropressHostedAdapter({
      provider: "runway",
      env: {
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "selector-runway",
      },
      content: supabase.content,
      media: supabase.media,
      revisions: supabase.revisions,
      auth: supabase.auth,
    });

    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.name).toBe("runway");
    expect(await supabase.preview?.create({ recordId: "x" })).toEqual({
      url: "https://selector.supabase.co/preview",
    });
    expect(await runway.preview?.create({ recordId: "x" })).toEqual({
      url: "https://runway.example/selector-runway/preview",
    });
  });

  it("selects local and hosted providers from explicit env maps", async () => {
    const localSupabase = createAstropressLocalAdapter({
      env: {
        ASTROPRESS_LOCAL_PROVIDER: "supabase",
      },
      workspaceRoot: await mkdtemp(join(tmpdir(), "astropress-local-env-")),
      dbPath: join(tmpdir(), `astropress-local-env-${Date.now()}.sqlite`),
    });
    const hostedRunway = createAstropressHostedAdapter({
      env: {
        ASTROPRESS_HOSTED_PROVIDER: "runway",
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "env-map-runway",
      },
      content: localSupabase.content,
      media: localSupabase.media,
      revisions: localSupabase.revisions,
      auth: localSupabase.auth,
    });

    expect(localSupabase.capabilities.name).toBe("supabase");
    expect(hostedRunway.capabilities.name).toBe("runway");
    expect(await hostedRunway.preview?.create({ recordId: "env-map" })).toEqual({
      url: "https://runway.example/env-map-runway/preview",
    });
  });

  it("selects the requested local provider runtime", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-provider-local-select-"));
    const supabase = createAstropressLocalAdapter({
      provider: "supabase",
      workspaceRoot: workspace,
      dbPath: join(workspace, "supabase-admin.sqlite"),
    });
    const runway = createAstropressLocalAdapter({
      provider: "runway",
      workspaceRoot: workspace,
      dbPath: join(workspace, "runway-admin.sqlite"),
    });
    const sqlite = createAstropressLocalAdapter({
      workspaceRoot: workspace,
      dbPath: join(workspace, "admin.sqlite"),
    });

    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.name).toBe("runway");
    expect(sqlite.capabilities.name).toBe("sqlite");

    await rm(workspace, { recursive: true, force: true });
  });

  it("creates a D1-backed Cloudflare adapter surface", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
    });

    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    db.prepare(
      `
        INSERT INTO content_entries (
          slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "cloudflare-post",
      "/cloudflare-post",
      "Cloudflare post",
      "post",
      "content",
      "runtime://content/cloudflare-post",
      "<p>Cloudflare body</p>",
      "Cloudflare summary",
      "Cloudflare SEO",
      "Cloudflare description",
    );
    db.prepare(
      `
        INSERT INTO content_overrides (
          slug, title, status, body, seo_title, meta_description, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "cloudflare-post",
      "Cloudflare post",
      "published",
      "<p>Cloudflare body</p>",
      "Cloudflare SEO",
      "Cloudflare description",
      "admin@example.com",
    );
    db.prepare(
      `
        INSERT INTO content_revisions (
          id, slug, source, title, status, body, seo_title, meta_description, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "revision-cloudflare-1",
      "cloudflare-post",
      "reviewed",
      "Cloudflare post",
      "published",
      "<p>Cloudflare body</p>",
      "Cloudflare SEO",
      "Cloudflare description",
      "admin@example.com",
    );
    db.prepare(
      `
        INSERT INTO media_assets (
          id, source_url, local_path, mime_type, alt_text, title, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "cloudflare-media-1",
      "https://cdn.example.com/cloudflare.png",
      "/media/cloudflare.png",
      "image/png",
      "Cloudflare alt",
      "cloudflare.png",
      "admin@example.com",
    );

    const cloudflare = createAstropressCloudflareAdapter({
      db: new SqliteBackedD1Database(db),
    });

    expect(cloudflare.capabilities.name).toBe("cloudflare");
    expect(cloudflare.capabilities.database).toBe(true);
    expect(cloudflare.capabilities.objectStorage).toBe(true);

    const user = await cloudflare.auth.signIn("admin@example.com", "password");
    expect(user?.role).toBe("admin");
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

  it("deploys a build directory to the github pages target", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-gh-pages-"));
    const buildDir = join(workspace, "dist");
    const outputDir = join(workspace, "deployments");
    await mkdir(buildDir, { recursive: true });
    await writeFile(join(buildDir, "index.html"), "<h1>Astropress</h1>");

    const target = createAstropressGitHubPagesDeployTarget({
      outputDir,
      baseUrl: "https://example.com/docs",
    });

    const result = await target.deploy({
      buildDir,
      projectName: "demo-site",
    });

    expect(result.url).toBe("https://example.com/docs/demo-site/");
    expect(await readFile(join(outputDir, "demo-site", "index.html"), "utf8")).toContain("Astropress");

    await rm(workspace, { recursive: true, force: true });
  });

  it("round-trips a project snapshot through git sync", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-sync-"));
    const projectDir = join(workspace, "project");
    const snapshotDir = join(workspace, "snapshot");
    await mkdir(join(projectDir, "src"), { recursive: true });
    await writeFile(join(projectDir, "package.json"), '{"name":"demo"}');
    await writeFile(join(projectDir, "src", "index.ts"), "export const demo = true;");

    const sync = createAstropressGitSyncAdapter({ projectDir });
    const exported = await sync.exportSnapshot(snapshotDir);
    await writeFile(join(projectDir, "src", "index.ts"), "export const demo = false;");
    const imported = await sync.importSnapshot(snapshotDir);

    expect(exported.fileCount).toBeGreaterThan(0);
    expect(imported.fileCount).toBe(exported.fileCount);
    expect(await readFile(join(projectDir, "src", "index.ts"), "utf8")).toContain("demo = true");

    await rm(workspace, { recursive: true, force: true });
  });

  it("counts wordpress records from an export file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-wordpress-"));
    const exportFile = join(workspace, "export.xml");
    await writeFile(
      exportFile,
      `
        <rss>
          <channel>
            <item><title>One</title><wp:attachment_url>https://cdn.example.com/a.jpg</wp:attachment_url></item>
            <item><title>Two</title></item>
          </channel>
        </rss>
      `,
    );

    const importer = createAstropressWordPressImportSource();
    const result = await importer.importWordPress({ exportFile });

    expect(result.importedRecords).toBe(2);
    expect(result.importedMedia).toBe(1);

    await rm(workspace, { recursive: true, force: true });
  });
});
