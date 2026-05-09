import { describe, expect, it } from "vitest";

import {
	findIntegrationByHref,
	INTEGRATIONS,
	integrationsByStatus,
} from "../src/integration-manifest";

describe("integration-manifest", () => {
	describe("INTEGRATIONS shape", () => {
		it("contains at least one entry per status bucket", () => {
			const statuses = new Set(INTEGRATIONS.map((e) => e.status));
			expect(statuses.has("real")).toBe(true);
			expect(statuses.has("env-gated")).toBe(true);
			expect(statuses.has("coming-soon")).toBe(true);
		});

		it("uses unique hrefs across the whole manifest", () => {
			const hrefs = INTEGRATIONS.map((e) => e.href);
			expect(new Set(hrefs).size).toBe(hrefs.length);
		});

		it("uses unique navKeys across the whole manifest", () => {
			const keys = INTEGRATIONS.map((e) => e.navKey);
			expect(new Set(keys).size).toBe(keys.length);
		});

		it("env-gated entries declare a configField, others do not", () => {
			for (const entry of INTEGRATIONS) {
				if (entry.status === "env-gated") {
					expect(
						entry.configField,
						`${entry.href} (env-gated) must declare a configField`,
					).toBeDefined();
				} else {
					expect(
						entry.configField,
						`${entry.href} (${entry.status}) must NOT declare a configField`,
					).toBeUndefined();
				}
			}
		});

		it("coming-soon entries declare a roadmapHref, others do not", () => {
			for (const entry of INTEGRATIONS) {
				if (entry.status === "coming-soon") {
					expect(entry.roadmapHref).toMatch(/^https:\/\//);
				} else {
					expect(entry.roadmapHref).toBeUndefined();
				}
			}
		});
	});

	describe("integrationsByStatus", () => {
		it("returns only entries with the requested status", () => {
			const real = integrationsByStatus("real");
			expect(real.length).toBeGreaterThan(0);
			for (const entry of real) {
				expect(entry.status).toBe("real");
			}
		});

		it("returns env-gated entries when asked for env-gated", () => {
			const envGated = integrationsByStatus("env-gated");
			expect(envGated.length).toBeGreaterThan(0);
			for (const entry of envGated) {
				expect(entry.status).toBe("env-gated");
			}
		});

		it("returns coming-soon entries when asked for coming-soon", () => {
			const comingSoon = integrationsByStatus("coming-soon");
			expect(comingSoon.length).toBeGreaterThan(0);
			for (const entry of comingSoon) {
				expect(entry.status).toBe("coming-soon");
			}
		});

		it("returned arrays partition INTEGRATIONS exactly", () => {
			const total =
				integrationsByStatus("real").length +
				integrationsByStatus("env-gated").length +
				integrationsByStatus("coming-soon").length;
			expect(total).toBe(INTEGRATIONS.length);
		});
	});

	describe("findIntegrationByHref", () => {
		it("returns the entry whose href matches exactly", () => {
			const sample = INTEGRATIONS[0];
			const found = findIntegrationByHref(sample.href);
			expect(found).toBeDefined();
			expect(found?.href).toBe(sample.href);
			expect(found?.navKey).toBe(sample.navKey);
		});

		it("does not return an entry whose href differs by even one character", () => {
			const sample = INTEGRATIONS[0];
			const result = findIntegrationByHref(`${sample.href}-not-a-real-href`);
			expect(result).toBeUndefined();
		});

		it("returns undefined for a wholly unknown href", () => {
			expect(findIntegrationByHref("/ap-admin/does-not-exist")).toBeUndefined();
		});

		it("distinguishes between adjacent entries", () => {
			// Pick two distinct entries; ensure the lookup returns each correctly.
			const a = INTEGRATIONS[0];
			const b = INTEGRATIONS[INTEGRATIONS.length - 1];
			expect(a.href).not.toBe(b.href);
			expect(findIntegrationByHref(a.href)?.href).toBe(a.href);
			expect(findIntegrationByHref(b.href)?.href).toBe(b.href);
		});
	});
});
