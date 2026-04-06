import { describe, expect, it } from "vitest";
import { createAstropressCloudflareAdapter } from "../src/adapters/cloudflare.js";

describe("cloudflare adapter security defaults", () => {
  it("does not allow insecure fallback sign-in unless explicitly enabled", async () => {
    const adapter = createAstropressCloudflareAdapter({
      users: [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
    });

    await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toBeNull();
  });

  it("supports explicit insecure fallback auth only for test-style callers", async () => {
    const adapter = createAstropressCloudflareAdapter({
      allowInsecureFallbackAuth: true,
      users: [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
    });

    await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });
  });
});
