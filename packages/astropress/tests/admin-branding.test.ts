import { afterEach, describe, expect, it } from "vitest";

import {
	ASTROPRESS_ADMIN_APP_NAME,
	ASTROPRESS_ADMIN_PRODUCT_NAME,
	buildAstropressAdminDocumentTitle,
} from "../src/admin-branding";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

afterEach(() => {
	(globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[CMS_CONFIG_KEY] = null;
});

describe("admin-branding constants", () => {
	it("exports the expected default product name", () => {
		expect(ASTROPRESS_ADMIN_PRODUCT_NAME).toBe("Astropress Admin");
	});

	it("exports the expected default app name", () => {
		expect(ASTROPRESS_ADMIN_APP_NAME).toBe("Astropress");
	});
});

describe("buildAstropressAdminDocumentTitle", () => {
	it("appends the product name with ' | ' separator when title is non-empty", () => {
		expect(buildAstropressAdminDocumentTitle("Dashboard")).toBe("Dashboard | Astropress Admin");
	});

	it("returns just the product name when title is empty string", () => {
		expect(buildAstropressAdminDocumentTitle("")).toBe("Astropress Admin");
	});

	it("returns just the product name when title is whitespace only", () => {
		expect(buildAstropressAdminDocumentTitle("   ")).toBe("Astropress Admin");
		expect(buildAstropressAdminDocumentTitle("\t\n  ")).toBe("Astropress Admin");
	});

	it("trims surrounding whitespace from non-empty titles before joining", () => {
		expect(buildAstropressAdminDocumentTitle("  Pages  ")).toBe("Pages | Astropress Admin");
	});
});
