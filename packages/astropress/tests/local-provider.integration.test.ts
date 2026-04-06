import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
  createAstropressCloudflareAdapter,
  createAstropressRunwayAdapter,
  createAstropressSupabaseAdapter,
} from "astropress";
import { createAstropressLocalAdapter } from "../src/adapters/local.js";
import { createAstropressRunwaySqliteAdapter } from "../src/adapters/runway-sqlite.js";
import { createAstropressSqliteAdapter } from "../src/adapters/sqlite.js";
import { createAstropressSupabaseSqliteAdapter } from "../src/adapters/supabase-sqlite.js";

describe("local provider integration", () => {
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
});
