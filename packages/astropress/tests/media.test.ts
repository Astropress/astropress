import { describe, expect, it } from "vitest";
import { getRuntimeMediaResolutionOptions, resolveMediaUrl, resolveRuntimeMediaUrl } from "astropress";

const sampleRecord = {
  id: "img-001",
  sourceUrl: "https://legacy.example.org/wp-content/uploads/hero.jpg",
  localPath: "/images/home/community-garden-hero.jpg",
  r2Key: "images/home/community-garden-hero.jpg",
};

describe("resolveMediaUrl()", () => {
  it("returns localPath in development mode", () => {
    const url = resolveMediaUrl(sampleRecord, { mode: "development" });
    expect(url).toBe(sampleRecord.localPath);
  });

  it("returns localPath in deployment mode when no r2BaseUrl is provided", () => {
    const url = resolveMediaUrl(sampleRecord, { mode: "deployment" });
    expect(url).toBe(sampleRecord.localPath);
  });

  it("returns r2 URL in deployment mode when r2BaseUrl is provided", () => {
    const url = resolveMediaUrl(sampleRecord, {
      mode: "deployment",
      r2BaseUrl: "https://cdn.example.org",
    });
    expect(url).toBe("https://cdn.example.org/images/home/community-garden-hero.jpg");
  });

  it("strips trailing slash from r2BaseUrl before joining", () => {
    const url = resolveMediaUrl(sampleRecord, {
      mode: "deployment",
      r2BaseUrl: "https://cdn.example.org/",
    });
    expect(url).not.toContain("//images");
    expect(url).toBe("https://cdn.example.org/images/home/community-garden-hero.jpg");
  });

  it("keeps localPath when no r2 key exists", () => {
    const url = resolveMediaUrl(
      { ...sampleRecord, r2Key: null },
      { mode: "deployment", r2BaseUrl: "https://cdn.example.org" },
    );
    expect(url).toBe(sampleRecord.localPath);
  });

  it("builds runtime media options from env defaults", () => {
    expect(getRuntimeMediaResolutionOptions()).toEqual({
      mode: "development",
      r2BaseUrl: undefined,
    });
  });

  it("switches runtime media options to deployment when an R2 base URL is configured", () => {
    expect(
      getRuntimeMediaResolutionOptions({
        runtime: { env: { PUBLIC_R2_BASE_URL: "https://cdn.example.org" } },
      } as App.Locals),
    ).toEqual({
      mode: "deployment",
      r2BaseUrl: "https://cdn.example.org",
    });
  });

  it("resolves runtime media URLs with local defaults", () => {
    expect(resolveRuntimeMediaUrl(sampleRecord)).toBe(sampleRecord.localPath);
  });

  it("resolves runtime media URLs to R2 when configured through runtime bindings", () => {
    expect(
      resolveRuntimeMediaUrl(sampleRecord, {
        runtime: { env: { PUBLIC_R2_BASE_URL: "https://cdn.example.org" } },
      } as App.Locals),
    ).toBe("https://cdn.example.org/images/home/community-garden-hero.jpg");
  });
});
