import { afterEach, describe, expect, it } from "vitest";

import {
	InboundWebhookRegistryError,
	_resetInboundWebhookRegistryForTests,
	getInboundWebhookProvider,
	listInboundWebhookProviders,
	registerInboundWebhookProvider,
} from "../../../src/integrations/webhooks/registry";

const GITHUB = {
	id: "github",
	label: "GitHub",
	signatureHeader: "X-Hub-Signature-256",
	algorithm: "hmac-sha256" as const,
	eventHeader: "X-GitHub-Event",
};

afterEach(() => _resetInboundWebhookRegistryForTests());

describe("registerInboundWebhookProvider", () => {
	it("registers a provider and returns the same definition", () => {
		expect(registerInboundWebhookProvider({ ...GITHUB })).toEqual(GITHUB);
	});

	it("getInboundWebhookProvider returns the registered provider", () => {
		registerInboundWebhookProvider({ ...GITHUB });
		expect(getInboundWebhookProvider("github")).toEqual(GITHUB);
	});

	it("getInboundWebhookProvider returns undefined for an unregistered id", () => {
		expect(getInboundWebhookProvider("github")).toBeUndefined();
	});

	it("rejects duplicate ids with DUPLICATE_PROVIDER", () => {
		registerInboundWebhookProvider({ ...GITHUB });
		expect(() => registerInboundWebhookProvider({ ...GITHUB })).toThrow(
			InboundWebhookRegistryError,
		);
	});

	it("listInboundWebhookProviders returns all registered providers", () => {
		registerInboundWebhookProvider({ ...GITHUB });
		registerInboundWebhookProvider({ ...GITHUB, id: "stripe" });
		const ids = listInboundWebhookProviders()
			.map((p) => p.id)
			.sort();
		expect(ids).toEqual(["github", "stripe"]);
	});

	it("listInboundWebhookProviders returns an empty array when none registered", () => {
		expect(listInboundWebhookProviders()).toEqual([]);
	});
});
