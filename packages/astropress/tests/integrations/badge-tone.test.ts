import { describe, expect, it } from "vitest";

import {
	type IntegrationStatusBadgeLabels,
	integrationStatusBadgeText,
	integrationStatusBadgeTone,
} from "../../src/integrations/badge-tone";

const LABELS: IntegrationStatusBadgeLabels = {
	connected: "Connected",
	error: "Needs attention",
	paused: "Paused",
	notConnected: "Not connected",
};

describe("integrationStatusBadgeTone", () => {
	it("maps 'connected' to 'ok'", () => {
		expect(integrationStatusBadgeTone("connected")).toBe("ok");
	});
	it("maps 'error' to 'err'", () => {
		expect(integrationStatusBadgeTone("error")).toBe("err");
	});
	it("maps 'paused' to 'warn'", () => {
		expect(integrationStatusBadgeTone("paused")).toBe("warn");
	});
	it("maps 'not-connected' to 'muted'", () => {
		expect(integrationStatusBadgeTone("not-connected")).toBe("muted");
	});
});

describe("integrationStatusBadgeText", () => {
	it("returns the connected label for 'connected'", () => {
		expect(integrationStatusBadgeText("connected", LABELS)).toBe("Connected");
	});
	it("returns the error label for 'error'", () => {
		expect(integrationStatusBadgeText("error", LABELS)).toBe("Needs attention");
	});
	it("returns the paused label for 'paused'", () => {
		expect(integrationStatusBadgeText("paused", LABELS)).toBe("Paused");
	});
	it("returns the notConnected label for 'not-connected'", () => {
		expect(integrationStatusBadgeText("not-connected", LABELS)).toBe("Not connected");
	});
	it("returns each label verbatim — no normalisation, escaping, or trim", () => {
		const padded: IntegrationStatusBadgeLabels = {
			connected: "  CON  ",
			error: "ERR<x>",
			paused: "",
			notConnected: "NOT&CON",
		};
		expect(integrationStatusBadgeText("connected", padded)).toBe("  CON  ");
		expect(integrationStatusBadgeText("error", padded)).toBe("ERR<x>");
		expect(integrationStatusBadgeText("paused", padded)).toBe("");
		expect(integrationStatusBadgeText("not-connected", padded)).toBe("NOT&CON");
	});
});
