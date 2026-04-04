import { afterEach, describe, expect, it, vi } from "vitest";

async function importRuntimeEnv() {
  vi.resetModules();
  return import("astropress");
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
});
