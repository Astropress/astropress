import { describe, expect, it } from "vitest";

import { createAstropressAdminAppIntegration } from "../src/admin-app-integration";

describe("admin app integration", () => {
  it("injects the full packaged admin route plan", () => {
    const integration = createAstropressAdminAppIntegration();
    const injectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];

    integration.hooks["astro:config:setup"]({
      injectRoute(route) {
        injectedRoutes.push(route);
      },
    } as never);

    expect(integration.name).toBe("astropress-admin-app");
    expect(injectedRoutes).toHaveLength(51);
    expect(injectedRoutes[0]?.pattern).toBe("/wp-admin");
    expect(injectedRoutes[0]?.entrypoint.endsWith("/pages/wp-admin/index.astro")).toBe(true);
    expect(injectedRoutes.at(-1)?.pattern).toBe("/wp-admin/actions/user-unsuspend");
  });
});
