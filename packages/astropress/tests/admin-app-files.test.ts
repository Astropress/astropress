import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveAstropressAdminRouteEntrypoints } from "../src/admin-routes";

const pagesDirectory = path.resolve(import.meta.dirname, "../pages/wp-admin");

describe("admin app files", () => {
  it("ships a page or endpoint file for every admin route entrypoint", () => {
    const routeEntrypoints = resolveAstropressAdminRouteEntrypoints(pagesDirectory);

    for (const route of routeEntrypoints) {
      expect(existsSync(route.entrypoint), `missing file for ${route.pattern}: ${route.entrypoint}`).toBe(true);
    }
  });
});
