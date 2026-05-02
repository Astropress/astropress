import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	registerAnalytics,
	registerCdnPurge,
	registerNewsletter,
} from "../../src/integrations/domains";
import {
	IntegrationRegistryError,
	_resetRegistryForTests,
	getProvider,
	listProviders,
	registerProvider,
} from "../../src/integrations/registry";

const noopVerify = async () => {
	/* no-op */
};

const baseDef = {
	id: "test-provider",
	label: "Test Provider",
	fields: z.object({ apiKey: z.string() }),
	verify: noopVerify,
};

afterEach(() => {
	_resetRegistryForTests();
});

describe("integration registry", () => {
	it("registers and looks up a provider by (domain, id)", () => {
		registerProvider("newsletter", baseDef);
		const found = getProvider("newsletter", "test-provider");
		expect(found?.id).toBe("test-provider");
		expect(found?.domain).toBe("newsletter");
	});

	it("isolates providers per domain (same id, different domain)", () => {
		registerProvider("newsletter", baseDef);
		registerProvider("analytics", baseDef);
		expect(getProvider("newsletter", "test-provider")?.domain).toBe(
			"newsletter",
		);
		expect(getProvider("analytics", "test-provider")?.domain).toBe("analytics");
	});

	it("rejects duplicate registration in the same domain", () => {
		registerProvider("newsletter", baseDef);
		expect(() => registerProvider("newsletter", baseDef)).toThrowError(
			IntegrationRegistryError,
		);
	});

	it("rejects an unknown domain", () => {
		expect(() =>
			// @ts-expect-error — runtime guard for hosts cast through `any`
			registerProvider("not-a-domain", baseDef),
		).toThrowError(IntegrationRegistryError);
	});

	it("listProviders returns only matches for the domain", () => {
		registerProvider("newsletter", { ...baseDef, id: "a" });
		registerProvider("newsletter", { ...baseDef, id: "b" });
		registerProvider("analytics", { ...baseDef, id: "a" });
		const newsletterIds = listProviders("newsletter")
			.map((p) => p.id)
			.sort();
		expect(newsletterIds).toEqual(["a", "b"]);
	});

	it("typed wrappers pin the domain", () => {
		registerNewsletter({ ...baseDef, id: "ml1" });
		registerAnalytics({ ...baseDef, id: "an1" });
		registerCdnPurge({ ...baseDef, id: "cd1" });
		expect(getProvider("newsletter", "ml1")?.domain).toBe("newsletter");
		expect(getProvider("analytics", "an1")?.domain).toBe("analytics");
		expect(getProvider("cdn-purge", "cd1")?.domain).toBe("cdn-purge");
	});

	it("getProvider returns undefined for unknown id", () => {
		registerProvider("newsletter", baseDef);
		expect(getProvider("newsletter", "missing")).toBeUndefined();
	});

	it("preserves verify callback and runtimeShape on lookup", () => {
		const fields = z.object({ apiKey: z.string() });
		const runtimeShape = z.object({ apiKey: z.string().min(8) });
		registerProvider("newsletter", {
			id: "shape",
			label: "Shape",
			fields,
			runtimeShape,
			verify: noopVerify,
		});
		const found = getProvider("newsletter", "shape");
		expect(found?.runtimeShape).toBe(runtimeShape);
		expect(found?.verify).toBe(noopVerify);
	});

	it("IntegrationRegistryError carries the typed code", () => {
		registerProvider("newsletter", baseDef);
		try {
			registerProvider("newsletter", baseDef);
			throw new Error("expected throw");
		} catch (err) {
			expect(err).toBeInstanceOf(IntegrationRegistryError);
			expect((err as IntegrationRegistryError).code).toBe("DUPLICATE_PROVIDER");
		}
	});

	it("UNKNOWN_DOMAIN error code is set", () => {
		try {
			// @ts-expect-error
			registerProvider("bogus", baseDef);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as IntegrationRegistryError).code).toBe("UNKNOWN_DOMAIN");
		}
	});

	it("listProviders returns empty array for empty domain", () => {
		expect(listProviders("monitoring")).toEqual([]);
	});

	it("registerProvider returns the registered entry with domain pinned", () => {
		const out = registerProvider("forms", { ...baseDef, id: "tally" });
		expect(out.domain).toBe("forms");
		expect(out.id).toBe("tally");
		expect(out.label).toBe("Test Provider");
	});
});
