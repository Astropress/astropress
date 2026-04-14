import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
  createAstropressAppwriteAdapter,
  createAstropressAppwriteHostedAdapter,
  createAstropressHostedAdapter,
  createAstropressHostedPlatformAdapter,
  createAstropressNeonHostedAdapter,
  createAstropressNhostHostedAdapter,
  createAstropressPocketbaseAdapter,
  createAstropressPocketbaseHostedAdapter,
  createAstropressRunwayAdapter,
  createAstropressRunwayHostedAdapter,
  createAstropressSupabaseAdapter,
  createAstropressSupabaseHostedAdapter,
  createAstropressTursoHostedAdapter,
  readAstropressAppwriteHostedConfig,
  readAstropressNeonHostedConfig,
  readAstropressNhostHostedConfig,
  readAstropressPocketbaseHostedConfig,
  readAstropressRunwayHostedConfig,
  readAstropressSupabaseHostedConfig,
  readAstropressTursoHostedConfig,
  resolveAstropressHostedProvider,
} from "@astropress-diy/astropress";
import {
  createAstropressAppwriteHostedAdapter as createDirectAppwriteHostedAdapter,
  readAstropressAppwriteHostedConfig as readDirectAppwriteHostedConfig,
} from "../src/adapters/appwrite.js";
import {
  createAstropressPocketbaseHostedAdapter as createDirectPocketbaseHostedAdapter,
  readAstropressPocketbaseHostedConfig as readDirectPocketbaseHostedConfig,
} from "../src/adapters/pocketbase.js";
import {
  createAstropressRunwayHostedAdapter as createDirectRunwayHostedAdapter,
  readAstropressRunwayHostedConfig as readDirectRunwayHostedConfig,
} from "../src/adapters/runway.js";
import {
  createAstropressSupabaseHostedAdapter as createDirectSupabaseHostedAdapter,
  readAstropressSupabaseHostedConfig as readDirectSupabaseHostedConfig,
} from "../src/adapters/supabase.js";
import { createAstropressLocalAdapter } from "../src/adapters/local.js";
import { createHostedStores } from "./helpers/provider-test-fixtures.js";

describe("hosted provider contracts", () => {
  it("lets Supabase and Runway use explicit hosted store modules", async () => {
    const supabaseHosted = createAstropressHostedPlatformAdapter({
      providerName: "supabase",
      ...createHostedStores(),
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

  it("lets Appwrite and PocketBase use explicit hosted store modules", async () => {
    const hosted = createAstropressHostedPlatformAdapter({
      providerName: "custom",
      ...createHostedStores(),
    });
    const appwrite = createAstropressAppwriteAdapter({
      backingAdapter: hosted,
    });
    const pocketbase = createAstropressPocketbaseAdapter({
      backingAdapter: hosted,
    });

    await appwrite.content.save({
      id: "custom-remote-post",
      kind: "post",
      slug: "custom-remote-post",
      status: "published",
      title: "Custom remote post",
    });

    expect(await appwrite.content.get("custom-remote-post")).toMatchObject({
      slug: "custom-remote-post",
      title: "Custom remote post",
    });
    expect(await appwrite.auth.signIn("admin@example.com", "password")).toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });
    expect(await pocketbase.content.get("custom-remote-post")).toMatchObject({
      slug: "custom-remote-post",
      title: "Custom remote post",
    });
  });

  it("creates Supabase and Runway hosted adapters with package-owned remote api defaults", async () => {
    const supabaseConfig = readDirectSupabaseHostedConfig({
      SUPABASE_URL: "https://demo.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    const runwayConfig = readDirectRunwayHostedConfig({
      RUNWAY_API_TOKEN: "token",
      RUNWAY_PROJECT_ID: "project-123",
    });

    const supabase = createDirectSupabaseHostedAdapter({
      config: supabaseConfig,
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
    });
    const runway = createDirectRunwayHostedAdapter({
      config: runwayConfig,
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
    });

    expect(supabaseConfig.apiBaseUrl).toContain("demo.supabase.co/functions/v1/astropress");
    expect(runwayConfig.apiBaseUrl).toContain("runway.example/project-123/astropress-api");
    expect((await supabase.preview?.create({ recordId: "hello" }))?.url).toContain(
      "demo.supabase.co/preview/preview/hello",
    );
    expect((await runway.preview?.create({ recordId: "hello" }))?.url).toContain(
      "runway.example/project-123/preview/preview/hello",
    );
    expect(supabase.capabilities.hostedAdmin).toBe(true);
    expect(runway.capabilities.serverRuntime).toBe(true);
  });

  it("creates Appwrite and PocketBase hosted adapters with package-owned remote api defaults", async () => {
    const appwriteConfig = readDirectAppwriteHostedConfig({
      APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      APPWRITE_PROJECT_ID: "project-123",
      APPWRITE_API_KEY: "secret",
    });
    const pocketbaseConfig = readDirectPocketbaseHostedConfig({
      POCKETBASE_URL: "https://pocketbase.example.com",
      POCKETBASE_EMAIL: "admin@example.com",
      POCKETBASE_PASSWORD: "secret",
    });

    const appwrite = createDirectAppwriteHostedAdapter({
      config: appwriteConfig,
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
    });
    const pocketbase = createDirectPocketbaseHostedAdapter({
      config: pocketbaseConfig,
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
    });

    expect(appwriteConfig.apiBaseUrl).toContain("cloud.appwrite.io/v1/functions/astropress");
    expect((await appwrite.preview?.create({ recordId: "hello" }))?.url).toContain(
      "cloud.appwrite.io/v1/console/project-project-123/preview/preview/hello",
    );
    expect(pocketbaseConfig.apiBaseUrl).toContain("pocketbase.example.com/api/astropress");
    expect((await pocketbase.preview?.create({ recordId: "hello" }))?.url).toContain(
      "pocketbase.example.com/preview",
    );
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
      apiBaseUrl: "https://example.supabase.co/functions/v1/astropress",
    });
    expect(
      readAstropressRunwayHostedConfig({
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "project-123",
      }),
    ).toEqual({
      apiToken: "token",
      projectId: "project-123",
      apiBaseUrl: "https://runway.example/project-123/astropress-api",
      previewBaseUrl: "https://runway.example/project-123",
    });
    expect(
      readAstropressAppwriteHostedConfig({
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "project-123",
        APPWRITE_API_KEY: "secret",
      }),
    ).toEqual({
      endpoint: "https://cloud.appwrite.io/v1",
      projectId: "project-123",
      apiKey: "secret",
        apiBaseUrl: "https://cloud.appwrite.io/v1/functions/astropress",
        previewBaseUrl: "https://cloud.appwrite.io/v1/console/project-project-123",
      });
    expect(
      readAstropressPocketbaseHostedConfig({
        POCKETBASE_URL: "https://pocketbase.example.com",
        POCKETBASE_EMAIL: "admin@example.com",
        POCKETBASE_PASSWORD: "secret",
      }),
    ).toEqual({
      url: "https://pocketbase.example.com",
      email: "admin@example.com",
      password: "secret",
      apiBaseUrl: "https://pocketbase.example.com/api/astropress",
      previewBaseUrl: "https://pocketbase.example.com",
    });
    expect(
      readAstropressNhostHostedConfig({
        NHOST_SUBDOMAIN: "abcdefgh",
        NHOST_REGION: "eu-central-1",
        NHOST_ADMIN_SECRET: "secret",
      }),
    ).toEqual({
      subdomain: "abcdefgh",
      region: "eu-central-1",
      adminSecret: "secret",
      apiBaseUrl: "https://abcdefgh.eu-central-1.nhost.run/v1/functions/astropress",
      previewBaseUrl: "https://abcdefgh.eu-central-1.nhost.run/console",
    });
    expect(
      readAstropressNeonHostedConfig({
        NEON_DATABASE_URL: "postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
        NEON_PROJECT_ID: "proj-quiet-moon-123456",
      }),
    ).toEqual({
      databaseUrl: "postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
      projectId: "proj-quiet-moon-123456",
      apiBaseUrl: "https://console.neon.tech/app/projects/proj-quiet-moon-123456",
    });
    expect(
      readAstropressTursoHostedConfig({
        TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
        TURSO_AUTH_TOKEN: "secret",
      }),
    ).toEqual({
      databaseUrl: "libsql://astropress-prod.turso.io",
      authToken: "secret",
      apiBaseUrl: "https://app.turso.tech/databases/astropress-prod",
    });
  });

  it("guards hosted provider config and builds hosted adapters with preview URLs", async () => {
    expect(() => readAstropressSupabaseHostedConfig({})).toThrow(/SUPABASE_URL/);
    expect(() => readAstropressRunwayHostedConfig({})).toThrow(/RUNWAY_API_TOKEN/);
    expect(() => readAstropressAppwriteHostedConfig({})).toThrow(/APPWRITE_ENDPOINT/);
    expect(() => readAstropressPocketbaseHostedConfig({})).toThrow(/POCKETBASE_URL/);
    expect(() => readAstropressNhostHostedConfig({})).toThrow(/NHOST_SUBDOMAIN/);
    expect(() => readAstropressNeonHostedConfig({})).toThrow(/NEON_DATABASE_URL|DATABASE_URL/);
    expect(() => readAstropressTursoHostedConfig({})).toThrow(/TURSO_DATABASE_URL/);

    const hostedStores = createHostedStores();
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
    const appwrite = createAstropressAppwriteHostedAdapter({
      env: {
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "project-123",
        APPWRITE_API_KEY: "secret",
      },
      ...hostedStores,
    });
    const pocketbase = createAstropressPocketbaseHostedAdapter({
      env: {
        POCKETBASE_URL: "https://pocketbase.example.com",
        POCKETBASE_EMAIL: "admin@example.com",
        POCKETBASE_PASSWORD: "secret",
      },
      ...hostedStores,
    });
    const nhost = createAstropressNhostHostedAdapter({
      env: {
        NHOST_SUBDOMAIN: "abcdefgh",
        NHOST_REGION: "eu-central-1",
        NHOST_ADMIN_SECRET: "secret",
      },
      ...hostedStores,
    });
    const neon = createAstropressNeonHostedAdapter({
      env: {
        NEON_DATABASE_URL: "postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
      },
      ...hostedStores,
    });
    const turso = createAstropressTursoHostedAdapter({
      env: {
        TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
        TURSO_AUTH_TOKEN: "secret",
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
    expect(await appwrite.preview?.create({ recordId: "hosted-config-post" })).toEqual({
      url: "https://cloud.appwrite.io/v1/console/project-project-123/preview",
    });
    expect(await pocketbase.preview?.create({ recordId: "hosted-config-post" })).toEqual({
      url: "https://pocketbase.example.com/preview",
    });
    expect(await nhost.preview?.create({ recordId: "hosted-config-post" })).toEqual({
      url: "https://abcdefgh.eu-central-1.nhost.run/console/preview",
    });
    expect(neon.capabilities.hostedAdmin).toBe(false);
    expect(await turso.preview?.create({ recordId: "hosted-config-post" })).toBeUndefined();
  });

  it("selects hosted providers from explicit options or env", async () => {
    expect(resolveAstropressHostedProvider(undefined)).toBe("supabase");
    expect(resolveAstropressHostedProvider("runway")).toBe("runway");
    expect(resolveAstropressHostedProvider("appwrite")).toBe("appwrite");
    expect(resolveAstropressHostedProvider("pocketbase")).toBe("pocketbase");
    expect(resolveAstropressHostedProvider("nhost")).toBe("nhost");
    expect(resolveAstropressHostedProvider("neon")).toBe("neon");
    expect(resolveAstropressHostedProvider("turso")).toBe("turso");
    expect(resolveAstropressHostedProvider("unexpected")).toBe("supabase");

    const hostedStores = createHostedStores();
    const supabase = createAstropressHostedAdapter({
      env: {
        SUPABASE_URL: "https://selector.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      ...hostedStores,
    });

    const runway = createAstropressHostedAdapter({
      provider: "runway",
      env: {
        RUNWAY_API_TOKEN: "token",
        RUNWAY_PROJECT_ID: "selector-runway",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });
    const appwrite = createAstropressHostedAdapter({
      provider: "appwrite",
      env: {
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "selector-appwrite",
        APPWRITE_API_KEY: "secret",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });
    const pocketbase = createAstropressHostedAdapter({
      provider: "pocketbase",
      env: {
        POCKETBASE_URL: "https://pocketbase.example.com",
        POCKETBASE_EMAIL: "admin@example.com",
        POCKETBASE_PASSWORD: "secret",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });
    const nhost = createAstropressHostedAdapter({
      provider: "nhost",
      env: {
        NHOST_SUBDOMAIN: "abcdefgh",
        NHOST_REGION: "eu-central-1",
        NHOST_ADMIN_SECRET: "secret",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });
    const neon = createAstropressHostedAdapter({
      provider: "neon",
      env: {
        NEON_DATABASE_URL: "postgres://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });
    const turso = createAstropressHostedAdapter({
      provider: "turso",
      env: {
        TURSO_DATABASE_URL: "libsql://astropress-prod.turso.io",
        TURSO_AUTH_TOKEN: "secret",
      },
      content: hostedStores.content,
      media: hostedStores.media,
      revisions: hostedStores.revisions,
      auth: hostedStores.auth,
    });

    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.name).toBe("runway");
    expect(appwrite.capabilities.objectStorage).toBe(true);
    expect(pocketbase.capabilities.database).toBe(true);
    expect(nhost.capabilities.name).toBe("nhost");
    expect(neon.capabilities.database).toBe(true);
    expect(turso.capabilities.name).toBe("turso");
    expect(await supabase.preview?.create({ recordId: "x" })).toEqual({
      url: "https://selector.supabase.co/preview",
    });
    expect(await runway.preview?.create({ recordId: "x" })).toEqual({
      url: "https://runway.example/selector-runway/preview",
    });
    expect(await appwrite.preview?.create({ recordId: "x" })).toEqual({
      url: "https://cloud.appwrite.io/v1/console/project-selector-appwrite/preview",
    });
    expect(await pocketbase.preview?.create({ recordId: "x" })).toEqual({
      url: "https://pocketbase.example.com/preview",
    });
    expect(await nhost.preview?.create({ recordId: "x" })).toEqual({
      url: "https://abcdefgh.eu-central-1.nhost.run/console/preview",
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
});
