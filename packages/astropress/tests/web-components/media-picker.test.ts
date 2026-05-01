// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../web-components/media-picker";

describe("ap-media-picker", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("registers the custom element", () => {
		expect(customElements.get("ap-media-picker")).toBeDefined();
	});

	it("opens its dialog when the trigger button is clicked", async () => {
		const target = document.createElement("input");
		target.id = "tgt";
		document.body.appendChild(target);

		const host = document.createElement("ap-media-picker");
		host.setAttribute("for", "tgt");
		host.innerHTML = `<button type="button" data-media-picker-trigger>Pick</button>`;
		document.body.appendChild(host);

		// Stub fetch with a minimal media list payload.
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "m1",
							url: "/m1.png",
							title: "One",
							altText: "alt",
							mimeType: "image/png",
							width: 100,
							height: 100,
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);
		// jsdom's HTMLDialogElement::showModal is missing — stub it.
		HTMLDialogElement.prototype.showModal = function () {
			this.setAttribute("open", "");
		};
		HTMLDialogElement.prototype.close = function () {
			this.removeAttribute("open");
		};

		const trigger = host.querySelector<HTMLButtonElement>(
			"[data-media-picker-trigger]",
		);
		trigger?.click();
		// allow the fetch promise to resolve
		await new Promise((r) => setTimeout(r, 0));
		expect(fetchSpy).toHaveBeenCalledWith(
			"/ap-admin/api/media",
			expect.objectContaining({ credentials: "same-origin" }),
		);
	});
});
