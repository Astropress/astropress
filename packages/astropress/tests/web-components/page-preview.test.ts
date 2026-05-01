// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "../../web-components/page-preview";

describe("ap-page-preview", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("registers the custom element", () => {
		expect(customElements.get("ap-page-preview")).toBeDefined();
	});

	it("builds an iframe and updates srcdoc from the target input", async () => {
		const input = document.createElement("input");
		input.id = "src";
		input.value = JSON.stringify({
			sections: [
				{ id: "h1", kind: "hero", headline: "Hello", alignment: "center" },
			],
		});
		document.body.appendChild(input);

		const host = document.createElement("ap-page-preview");
		host.setAttribute("for", "src");
		document.body.appendChild(host);

		const iframe = host.querySelector("iframe");
		expect(iframe).not.toBeNull();
		// srcdoc should have been set on connect (initial refresh)
		expect(iframe?.getAttribute("srcdoc") ?? "").toContain("Hello");
	});
});
