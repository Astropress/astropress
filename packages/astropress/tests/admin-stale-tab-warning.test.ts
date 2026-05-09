import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level invariants for the <ap-stale-tab-warning> web component.
// Single-target test: only reads the component source + the package.json
// subpath export entry. Mutations to other files do not invalidate this
// suite's stryker cache.

const wcPath = path.resolve(import.meta.dirname, "../web-components/ap-stale-tab-warning.ts");
const pkgPath = path.resolve(import.meta.dirname, "../package.json");

describe("ap-stale-tab-warning web component", () => {
	it("source file exists and exports ApStaleTabWarning class", () => {
		const source = readFileSync(wcPath, "utf8");
		expect(source).toContain("export class ApStaleTabWarning");
		expect(source).toContain("BroadcastChannel");
		expect(source).toContain("astropress-editor");
		expect(source).toContain("customElements.define");
		expect(source).toContain('"ap-stale-tab-warning"');
	});

	it("broadcasts editing message on connectedCallback with unique tab id", () => {
		const source = readFileSync(wcPath, "utf8");
		// Must post { type: "editing", slug, id } on connect
		expect(source).toContain('"editing"');
		expect(source).toContain("crypto.randomUUID()");
		// Must post { type: "left", slug, id } on disconnect
		expect(source).toContain('"left"');
		expect(source).toContain("disconnectedCallback");
	});

	it("shows stale-tab warning when another editing message arrives for the same slug", () => {
		const source = readFileSync(wcPath, "utf8");
		// Must render a role="alert" warning element
		expect(source).toContain('role", "alert"');
		expect(source).toContain("Another tab is editing this post");
	});

	it("shows stale-session warning when page open time exceeds TTL", () => {
		const source = readFileSync(wcPath, "utf8");
		expect(source).toContain("This page has been open over an hour");
		expect(source).toContain("session-ttl-ms");
	});

	it("subpath export exists in package.json", () => {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
		expect(pkg.exports["./web-components/ap-stale-tab-warning"]).toBeDefined();
	});
});
