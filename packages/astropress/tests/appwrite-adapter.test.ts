import { describe, expect, it } from "vitest";
import {
  createAstropressAppwriteAdapter,
  createAstropressAppwriteHostedAdapter,
  readAstropressAppwriteHostedConfig,
} from "../src/adapters/appwrite.js";
import { createHostedStores } from "./helpers/provider-test-fixtures.js";

describe("readAstropressAppwriteHostedConfig", () => {
  it("reads all required env vars", () => {
    const config = readAstropressAppwriteHostedConfig({
      APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      APPWRITE_PROJECT_ID: "proj-abc",
      APPWRITE_API_KEY: "api-secret",
    });
    expect(config.endpoint).toBe("https://cloud.appwrite.io/v1");
    expect(config.projectId).toBe("proj-abc");
    expect(config.apiKey).toBe("api-secret");
    expect(config.apiBaseUrl).toBe("https://cloud.appwrite.io/v1/functions/astropress");
    expect(config.previewBaseUrl).toBe("https://cloud.appwrite.io/v1/console/project-proj-abc");
  });

  it("strips trailing slash from endpoint before building URLs", () => {
    const config = readAstropressAppwriteHostedConfig({
      APPWRITE_ENDPOINT: "https://self-hosted.example.com/",
      APPWRITE_PROJECT_ID: "my-project",
      APPWRITE_API_KEY: "key",
    });
    expect(config.apiBaseUrl).toBe("https://self-hosted.example.com/functions/astropress");
    expect(config.previewBaseUrl).toBe("https://self-hosted.example.com/console/project-my-project");
  });

  it("includes databaseId and bucketId when provided", () => {
    const config = readAstropressAppwriteHostedConfig({
      APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      APPWRITE_PROJECT_ID: "proj-abc",
      APPWRITE_API_KEY: "key",
      APPWRITE_DATABASE_ID: "db-content",
      APPWRITE_BUCKET_ID: "bucket-media",
    });
    expect(config.databaseId).toBe("db-content");
    expect(config.bucketId).toBe("bucket-media");
  });

  it("omits databaseId and bucketId when not provided", () => {
    const config = readAstropressAppwriteHostedConfig({
      APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      APPWRITE_PROJECT_ID: "proj-abc",
      APPWRITE_API_KEY: "key",
    });
    expect("databaseId" in config).toBe(false);
    expect("bucketId" in config).toBe(false);
  });

  it("throws when APPWRITE_ENDPOINT is missing", () => {
    expect(() =>
      readAstropressAppwriteHostedConfig({
        APPWRITE_PROJECT_ID: "proj-abc",
        APPWRITE_API_KEY: "key",
      }),
    ).toThrow(/APPWRITE_ENDPOINT/);
  });

  it("throws when APPWRITE_PROJECT_ID is missing", () => {
    expect(() =>
      readAstropressAppwriteHostedConfig({
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_API_KEY: "key",
      }),
    ).toThrow(/APPWRITE_PROJECT_ID/);
  });

  it("throws when APPWRITE_API_KEY is missing", () => {
    expect(() =>
      readAstropressAppwriteHostedConfig({
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "proj-abc",
      }),
    ).toThrow(/APPWRITE_API_KEY/);
  });
});

describe("createAstropressAppwriteAdapter", () => {
  it("reports providerName as appwrite", () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
    });
    expect(adapter.capabilities.name).toBe("appwrite");
  });

  it("has database and objectStorage capabilities", () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
    });
    expect(adapter.capabilities.database).toBe(true);
    expect(adapter.capabilities.objectStorage).toBe(true);
    expect(adapter.capabilities.serverRuntime).toBe(true);
    expect(adapter.capabilities.hostedAdmin).toBe(true);
  });

  it("includes hostPanel pointing to Appwrite Console", () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
    });
    expect(adapter.capabilities.hostPanel).toMatchObject({
      mode: "link",
      label: "Appwrite Console",
      url: expect.stringContaining("appwrite.io"),
    });
  });

  it("allows custom hostPanel to be provided", () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
      defaultCapabilities: {
        hostPanel: { mode: "iframe", url: "https://appwrite.internal", label: "Internal Console" },
      },
    });
    expect(adapter.capabilities.hostPanel).toEqual({
      mode: "iframe",
      url: "https://appwrite.internal",
      label: "Internal Console",
    });
  });

  it("stores and retrieves content via backing adapter", async () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
    });
    await adapter.content.save({
      id: "appwrite-test-post",
      kind: "post",
      slug: "appwrite-test-post",
      status: "published",
      title: "Appwrite test post",
    });
    const record = await adapter.content.get("appwrite-test-post");
    expect(record).toMatchObject({
      slug: "appwrite-test-post",
      title: "Appwrite test post",
    });
  });

  it("auth signIn works via backing adapter", async () => {
    const adapter = createAstropressAppwriteAdapter({
      ...createHostedStores(),
    });
    const user = await adapter.auth.signIn("admin@example.com", "password");
    expect(user).toMatchObject({ email: "admin@example.com", role: "admin" });
  });
});

describe("createAstropressAppwriteHostedAdapter", () => {
  const env = {
    APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
    APPWRITE_PROJECT_ID: "proj-hosted",
    APPWRITE_API_KEY: "hosted-key",
  };

  it("creates a hosted adapter with project-specific hostPanel URL", () => {
    const adapter = createAstropressAppwriteHostedAdapter({
      env,
      ...createHostedStores(),
    });
    expect(adapter.capabilities.name).toBe("appwrite");
    expect(adapter.capabilities.hostPanel?.url).toContain("proj-hosted");
    expect(adapter.capabilities.hostPanel?.label).toBe("Appwrite Console");
  });

  it("preview URL uses the previewBaseUrl path", async () => {
    const adapter = createAstropressAppwriteHostedAdapter({
      env,
      ...createHostedStores(),
    });
    const preview = await adapter.preview?.create({ recordId: "my-post" });
    expect(preview?.url).toContain("cloud.appwrite.io");
    expect(preview?.url).toContain("proj-hosted");
    expect(preview?.url).toContain("preview");
  });

  it("uses hosted API adapter when no stores are provided", async () => {
    const adapter = createAstropressAppwriteHostedAdapter({
      config: {
        endpoint: "https://cloud.appwrite.io/v1",
        projectId: "proj-api",
        apiKey: "api-key",
        apiBaseUrl: "https://cloud.appwrite.io/v1/functions/astropress",
        previewBaseUrl: "https://cloud.appwrite.io/v1/console/project-proj-api",
      },
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 }),
    });
    expect(adapter.capabilities.name).toBe("appwrite");
    expect(adapter.capabilities.database).toBe(true);
  });

  it("respects backing adapter stores when provided", async () => {
    const stores = createHostedStores();
    const adapter = createAstropressAppwriteHostedAdapter({ env, ...stores });
    await adapter.content.save({
      id: "hosted-post",
      kind: "post",
      slug: "hosted-post",
      status: "published",
      title: "Hosted post",
    });
    expect(await adapter.content.get("hosted-post")).toMatchObject({ slug: "hosted-post" });
  });

  it("includes databaseId and bucketId in config when env vars set", () => {
    const config = readAstropressAppwriteHostedConfig({
      ...env,
      APPWRITE_DATABASE_ID: "main-db",
      APPWRITE_BUCKET_ID: "media-bucket",
    });
    expect(config.databaseId).toBe("main-db");
    expect(config.bucketId).toBe("media-bucket");
  });
});
