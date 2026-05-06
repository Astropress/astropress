import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	registerAbTesting,
	registerAnalytics,
	registerCdnPurge,
	registerDeployHooks,
	registerForms,
	registerMonitoring,
	registerNewsletter,
	registerSearch,
} from "../../src/integrations/domains";
import {
	_resetRegistryForTests,
	getProvider,
	IntegrationRegistryError,
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
		expect(getProvider("newsletter", "test-provider")?.domain).toBe("newsletter");
		expect(getProvider("analytics", "test-provider")?.domain).toBe("analytics");
	});

	it("rejects duplicate registration in the same domain", () => {
		registerProvider("newsletter", baseDef);
		expect(() => registerProvider("newsletter", baseDef)).toThrowError(IntegrationRegistryError);
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

	it("every typed wrapper pins the right domain", () => {
		registerNewsletter({ ...baseDef, id: "ml1" });
		registerAnalytics({ ...baseDef, id: "an1" });
		registerAbTesting({ ...baseDef, id: "ab1" });
		registerSearch({ ...baseDef, id: "se1" });
		registerCdnPurge({ ...baseDef, id: "cd1" });
		registerMonitoring({ ...baseDef, id: "mn1" });
		registerForms({ ...baseDef, id: "fm1" });
		registerDeployHooks({ ...baseDef, id: "dh1" });
		expect(getProvider("newsletter", "ml1")?.domain).toBe("newsletter");
		expect(getProvider("analytics", "an1")?.domain).toBe("analytics");
		expect(getProvider("ab-testing", "ab1")?.domain).toBe("ab-testing");
		expect(getProvider("search", "se1")?.domain).toBe("search");
		expect(getProvider("cdn-purge", "cd1")?.domain).toBe("cdn-purge");
		expect(getProvider("monitoring", "mn1")?.domain).toBe("monitoring");
		expect(getProvider("forms", "fm1")?.domain).toBe("forms");
		expect(getProvider("deploy-hooks", "dh1")?.domain).toBe("deploy-hooks");
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

	it("INTEGRATION_DOMAINS contains every typed domain literal", () => {
		// Forces each string literal to remain in the typed array; a
		// stryker StringLiteral mutant on any of them would break a
		// registration with that domain.
		registerProvider("newsletter", { ...baseDef, id: "p" });
		registerProvider("analytics", { ...baseDef, id: "p" });
		registerProvider("ab-testing", { ...baseDef, id: "p" });
		registerProvider("search", { ...baseDef, id: "p" });
		registerProvider("cdn-purge", { ...baseDef, id: "p" });
		registerProvider("monitoring", { ...baseDef, id: "p" });
		registerProvider("forms", { ...baseDef, id: "p" });
		registerProvider("deploy-hooks", { ...baseDef, id: "p" });
		expect(getProvider("newsletter", "p")?.domain).toBe("newsletter");
		expect(getProvider("analytics", "p")?.domain).toBe("analytics");
		expect(getProvider("ab-testing", "p")?.domain).toBe("ab-testing");
		expect(getProvider("search", "p")?.domain).toBe("search");
		expect(getProvider("cdn-purge", "p")?.domain).toBe("cdn-purge");
		expect(getProvider("monitoring", "p")?.domain).toBe("monitoring");
		expect(getProvider("forms", "p")?.domain).toBe("forms");
		expect(getProvider("deploy-hooks", "p")?.domain).toBe("deploy-hooks");
	});

	it("DUPLICATE_PROVIDER error message names the domain and id", () => {
		registerProvider("newsletter", baseDef);
		try {
			registerProvider("newsletter", baseDef);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as Error).message).toContain("test-provider");
			expect((err as Error).message).toContain("newsletter");
		}
	});

	it("UNKNOWN_DOMAIN error message names the offending domain", () => {
		try {
			// @ts-expect-error
			registerProvider("not-real", baseDef);
			throw new Error("expected throw");
		} catch (err) {
			expect((err as Error).message).toContain("not-real");
		}
	});
});
