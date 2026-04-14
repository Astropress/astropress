import { afterEach, describe, expect, it, vi } from "vitest";

async function importRuntimeEnv() {
  vi.resetModules();
  return import("../src/runtime-env.js");
}

describe("runtime env login security config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps production login attempts strict", async () => {
    vi.stubEnv("PROD", true);
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(5);
    expect(runtimeEnv.getLoginSecurityConfig().secureCookies).toBe(true);
  });

  it("uses a higher login-attempt ceiling outside production for repeated test logins", async () => {
    vi.stubEnv("PROD", false);
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(250);
    expect(runtimeEnv.getLoginSecurityConfig().secureCookies).toBe(false);
  });

  it("keeps the login-attempt ceiling strict during playwright runs", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("PLAYWRIGHT_E2E_MODE", "admin");
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(5);
  });

  it("allows an explicit login-attempt override", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("LOGIN_MAX_ATTEMPTS", "12");
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(12);
  });

  it("accepts legacy ASTROPRESS_* bootstrap env aliases", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("ASTROPRESS_SESSION_SECRET", "legacy-session-secret");
    vi.stubEnv("ASTROPRESS_ADMIN_PASSWORD", "legacy-admin-password");
    vi.stubEnv("ASTROPRESS_EDITOR_PASSWORD", "legacy-editor-password");
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getAstropressRootSecret()).toBe("legacy-session-secret");
    expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
      adminPassword: "legacy-admin-password",
      editorPassword: "legacy-editor-password",
      sessionSecret: "legacy-session-secret",
    });
  });

  it("exposes current and previous bootstrap secrets during rotation", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("SESSION_SECRET", "current-session-secret");
    vi.stubEnv("SESSION_SECRET_PREV", "previous-session-secret");
    const runtimeEnv = await importRuntimeEnv();

    expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual([
      "current-session-secret",
      "previous-session-secret",
    ]);
    expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
      rootSecret: "current-session-secret",
      rootSecretPrevious: "previous-session-secret",
      sessionSecret: "current-session-secret",
      sessionSecretPrevious: "previous-session-secret",
    });
  });
});
