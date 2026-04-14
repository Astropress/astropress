import { describe, expect, it } from "vitest";
import {
  getAstropressDeploymentMatrixEntry,
  listAstropressDeploymentMatrixEntries,
  resolveAstropressDeploymentSupportLevel,
} from "../src/deployment-matrix.js";

describe("deployment matrix — supported pairs", () => {
  it("marks first-class pairs as supported", () => {
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "vercel",
        dataServices: "supabase",
      }),
    ).toBe("supported");
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "cloudflare-pages",
        dataServices: "cloudflare",
      }),
    ).toBe("supported");
  });

  it("marks unlisted pairs as unsupported", () => {
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "github-pages",
        dataServices: "appwrite",
      }),
    ).toBe("unsupported");
  });

  it("returns env requirements for listed pairs", () => {
    const entry = getAstropressDeploymentMatrixEntry({
      appHost: "render-web",
      dataServices: "appwrite",
    });
    expect(entry?.supportLevel).toBe("preview");
    expect(entry?.requiredEnvKeys).toContain("ASTROPRESS_SERVICE_ORIGIN");
    expect(entry?.requiredEnvKeys).toContain("APPWRITE_ENDPOINT");
  });
});

describe("deployment matrix — Fly.io preview pairs", () => {
  it("marks fly-io + none as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "fly-io", dataServices: "none" })).toBe("preview");
  });
  it("marks fly-io + supabase as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "fly-io", dataServices: "supabase" })).toBe("preview");
  });
  it("marks fly-io + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "fly-io", dataServices: "turso" })).toBe("preview");
  });
  it("fly-io + supabase includes Supabase env keys", () => {
    const entry = getAstropressDeploymentMatrixEntry({ appHost: "fly-io", dataServices: "supabase" });
    expect(entry?.requiredEnvKeys).toContain("SUPABASE_URL");
    expect(entry?.requiredEnvKeys).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("deployment matrix — Coolify preview pairs", () => {
  it("marks coolify + none as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "coolify", dataServices: "none" })).toBe("preview");
  });
  it("marks coolify + supabase as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "coolify", dataServices: "supabase" })).toBe("preview");
  });
  it("marks coolify + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "coolify", dataServices: "turso" })).toBe("preview");
  });
});

describe("deployment matrix — DigitalOcean preview pairs", () => {
  it("marks digitalocean + supabase as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "digitalocean", dataServices: "supabase" })).toBe("preview");
  });
  it("marks digitalocean + appwrite as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "digitalocean", dataServices: "appwrite" })).toBe("preview");
  });
  it("marks digitalocean + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "digitalocean", dataServices: "turso" })).toBe("preview");
  });
  it("digitalocean + appwrite includes Appwrite env keys", () => {
    const entry = getAstropressDeploymentMatrixEntry({ appHost: "digitalocean", dataServices: "appwrite" });
    expect(entry?.requiredEnvKeys).toContain("APPWRITE_ENDPOINT");
    expect(entry?.requiredEnvKeys).toContain("APPWRITE_PROJECT_ID");
  });
});

describe("deployment matrix — Railway preview pairs (paid platform)", () => {
  it("marks railway + none as preview (not supported — no free tier)", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "railway", dataServices: "none" })).toBe("preview");
  });
  it("marks railway + supabase as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "railway", dataServices: "supabase" })).toBe("preview");
  });
  it("marks railway + appwrite as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "railway", dataServices: "appwrite" })).toBe("preview");
  });
  it("marks railway + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "railway", dataServices: "turso" })).toBe("preview");
  });
  it("railway is never 'supported' — no official end-to-end test path", () => {
    const entries = listAstropressDeploymentMatrixEntries().filter(e => e.appHost === "railway");
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.supportLevel).not.toBe("supported");
    }
  });
  it("railway notes warn of paid billing", () => {
    const entries = listAstropressDeploymentMatrixEntries().filter(e => e.appHost === "railway");
    for (const e of entries) {
      expect(e.notes.toLowerCase()).toContain("paid");
    }
  });
});

describe("deployment matrix — Turso preview pairs", () => {
  it("marks vercel + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "vercel", dataServices: "turso" })).toBe("preview");
  });
  it("marks netlify + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "netlify", dataServices: "turso" })).toBe("preview");
  });
  it("marks render-web + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "render-web", dataServices: "turso" })).toBe("preview");
  });
  it("marks cloudflare-pages + turso as preview", () => {
    expect(resolveAstropressDeploymentSupportLevel({ appHost: "cloudflare-pages", dataServices: "turso" })).toBe("preview");
  });
  it("turso env keys contain TURSO_DATABASE_URL and TURSO_AUTH_TOKEN", () => {
    const entry = getAstropressDeploymentMatrixEntry({ appHost: "vercel", dataServices: "turso" });
    expect(entry?.requiredEnvKeys).toContain("TURSO_DATABASE_URL");
    expect(entry?.requiredEnvKeys).toContain("TURSO_AUTH_TOKEN");
  });
});
