// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "../../web-components/section-editor";

function mount(initial: object): HTMLElement {
	const host = document.createElement("ap-section-editor");
	host.innerHTML = `
<script type="application/json" data-section-editor-state>${JSON.stringify(initial)}</script>
<input type="hidden" id="payload" data-section-editor-input />
<div data-section-editor-list></div>
<button type="button" data-section-editor-add>Add</button>
<dialog data-section-editor-add-dialog>
  <div data-section-editor-templates></div>
  <div data-section-editor-kinds></div>
</dialog>
`;
	document.body.appendChild(host);
	return host;
}

describe("ap-section-editor", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("seeds the hidden input with the initial sections", () => {
		mount({
			sections: [
				{
					id: "s1",
					kind: "hero",
					headline: "Hi",
					alignment: "center",
				},
			],
			templates: [],
		});
		const input = document.querySelector<HTMLInputElement>("#payload");
		expect(input).not.toBeNull();
		const parsed = JSON.parse(input?.value ?? "{}") as {
			sections: Array<{ kind: string; headline: string }>;
		};
		expect(parsed.sections).toHaveLength(1);
		expect(parsed.sections[0].kind).toBe("hero");
		expect(parsed.sections[0].headline).toBe("Hi");
	});

	it("renders one card per section", () => {
		mount({
			sections: [
				{ id: "a", kind: "hero", headline: "A", alignment: "start" },
				{
					id: "b",
					kind: "rich-text",
					html: "<p>Hello</p>",
				},
			],
			templates: [],
		});
		const cards = document.querySelectorAll(".ap-section-card");
		expect(cards.length).toBe(2);
	});

	it("renders the empty state when no sections", () => {
		mount({ sections: [], templates: [] });
		const empty = document.querySelector(".ap-section-editor__empty");
		expect(empty).not.toBeNull();
	});

	it("updates the hidden input when an input value changes", () => {
		mount({
			sections: [{ id: "x", kind: "hero", headline: "Old", alignment: "start" }],
			templates: [],
		});
		const headlineInput = document.querySelector<HTMLInputElement>('[data-field="headline"]');
		expect(headlineInput).not.toBeNull();
		if (!headlineInput) return;
		headlineInput.value = "New headline";
		headlineInput.dispatchEvent(new Event("input", { bubbles: true }));
		const payload = JSON.parse(
			document.querySelector<HTMLInputElement>("#payload")?.value ?? "{}",
		) as { sections: Array<{ headline: string }> };
		expect(payload.sections[0].headline).toBe("New headline");
	});
});
