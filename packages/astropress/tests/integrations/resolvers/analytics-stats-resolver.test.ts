import { describe, expect, it } from "vitest";

import { resolveAnalyticsStats } from "../../../src/integrations/resolvers/analytics-stats-resolver";

const REG = {
	host: "https://plausible.io",
	siteId: "example.com",
	apiKey: "plausible-token",
};

describe("resolveAnalyticsStats", () => {
	it("returns plausible kind with all fields when registry is fully populated", () => {
		expect(resolveAnalyticsStats({ registry: REG })).toEqual({
			kind: "plausible",
			host: "https://plausible.io",
			siteId: "example.com",
			apiKey: "plausible-token",
		});
	});

	it("returns kind: 'none' when registry is null", () => {
		expect(resolveAnalyticsStats({ registry: null })).toEqual({ kind: "none" });
	});

	it("returns kind: 'none' when registry is undefined (input is empty)", () => {
		expect(resolveAnalyticsStats({})).toEqual({ kind: "none" });
	});

	it("returns kind: 'none' when host is empty", () => {
		expect(resolveAnalyticsStats({ registry: { ...REG, host: "" } })).toEqual({
			kind: "none",
		});
	});

	it("returns kind: 'none' when siteId is empty", () => {
		expect(resolveAnalyticsStats({ registry: { ...REG, siteId: "" } })).toEqual({ kind: "none" });
	});

	it("returns kind: 'none' when apiKey is empty", () => {
		expect(resolveAnalyticsStats({ registry: { ...REG, apiKey: "" } })).toEqual({ kind: "none" });
	});

	it("propagates the registry's host verbatim (does not normalize trailing slash)", () => {
		const r = resolveAnalyticsStats({
			registry: { ...REG, host: "https://stats.example.com/" },
		});
		expect(r).toMatchObject({ host: "https://stats.example.com/" });
	});

	it("propagates the registry's siteId verbatim (no URL-decoding etc.)", () => {
		const r = resolveAnalyticsStats({
			registry: { ...REG, siteId: "team/site:prod" },
		});
		expect(r).toMatchObject({ siteId: "team/site:prod" });
	});

	it("propagates the registry's apiKey verbatim (no trim)", () => {
		const r = resolveAnalyticsStats({
			registry: { ...REG, apiKey: "  pad  " },
		});
		expect(r).toMatchObject({ apiKey: "  pad  " });
	});
});
