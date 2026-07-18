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
		// jsdom doesn't implement dialog.close(); the editor calls it after a
		// template/kind pick. Polyfill so the real click path doesn't throw.
		if (typeof HTMLDialogElement !== "undefined") {
			HTMLDialogElement.prototype.close = function close() {
				this.open = false;
			};
			HTMLDialogElement.prototype.showModal = function showModal() {
				this.open = true;
			};
		}
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

	it("inserts a template's embedded (rich, valid) sections with fresh ids (#190)", () => {
		mount({
			sections: [],
			templates: [
				{
					key: "about",
					defaultTitle: "About page",
					defaultDescription: "",
					sectionKinds: ["hero"],
					sections: [{ id: "orig-1", kind: "hero", headline: "About us", alignment: "start" }],
				},
			],
		});
		// Drive the delegated dialog handler directly (jsdom lacks dialog.showModal()).
		const tplList = document.querySelector<HTMLElement>("[data-section-editor-templates]");
		if (!tplList) throw new Error("no template list");
		tplList.innerHTML = `<button type="button" data-template="about">About</button>`;
		tplList.querySelector<HTMLButtonElement>('[data-template="about"]')?.click();

		const payload = JSON.parse(
			document.querySelector<HTMLInputElement>("#payload")?.value ?? "{}",
		) as { sections: Array<{ kind: string; headline: string; id: string }> };
		expect(payload.sections).toHaveLength(1);
		expect(payload.sections[0].headline).toBe("About us");
		expect(payload.sections[0].id).not.toBe("orig-1"); // cloned with a fresh id
	});

	function mountInForm(initial: object): HTMLFormElement {
		const form = document.createElement("form");
		const host = document.createElement("ap-section-editor");
		host.innerHTML = `
<script type="application/json" data-section-editor-state>${JSON.stringify(initial)}</script>
<input type="hidden" id="payload" data-section-editor-input />
<p data-section-editor-error hidden></p>
<div data-section-editor-list></div>
<button type="button" data-section-editor-add>Add</button>
<dialog data-section-editor-add-dialog><div data-section-editor-templates></div><div data-section-editor-kinds></div></dialog>
`;
		form.appendChild(host);
		document.body.appendChild(form);
		return form;
	}

	it("blocks submit and keeps sections when a required field is empty (#190 data-loss)", () => {
		const form = mountInForm({
			sections: [{ id: "s1", kind: "hero", headline: "", alignment: "start" }],
			templates: [],
		});
		const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
		const proceeded = form.dispatchEvent(submitEvent);

		// preventDefault was called -> the form does not submit -> no lossy round-trip.
		expect(proceeded).toBe(false);
		const err = document.querySelector<HTMLElement>("[data-section-editor-error]");
		expect(err?.hidden).toBe(false);
		expect(err?.textContent).toContain("Hero");
		// The in-progress section is still there.
		const payload = JSON.parse(
			document.querySelector<HTMLInputElement>("#payload")?.value ?? "{}",
		) as { sections: unknown[] };
		expect(payload.sections).toHaveLength(1);
	});

	it("allows submit when all required fields are filled (#190)", () => {
		const form = mountInForm({
			sections: [{ id: "s1", kind: "hero", headline: "Real headline", alignment: "start" }],
			templates: [],
		});
		const proceeded = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		expect(proceeded).toBe(true);
	});

	// Cases the earlier hand-written client mirror missed — now caught because the
	// client validates with the same `parseSections` the server uses (#190).
	it("blocks a hero with a CTA label but empty href (the issue's cited example)", () => {
		const form = mountInForm({
			sections: [
				{
					id: "s1",
					kind: "hero",
					headline: "Hi",
					alignment: "center",
					primaryCta: { label: "Click me", href: "" },
				},
			],
			templates: [],
		});
		const proceeded = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		expect(proceeded).toBe(false);
		expect(document.querySelector("[data-section-editor-error]")?.textContent).toContain("href");
	});

	it("blocks a feature-grid item with empty title/body", () => {
		const form = mountInForm({
			sections: [
				{ id: "s1", kind: "feature-grid", heading: "Feats", columns: 3, items: [{ title: "", body: "" }] },
			],
			templates: [],
		});
		const proceeded = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		expect(proceeded).toBe(false);
	});

	it("restores stashed sections after a failed save (?error=1) instead of the DB copy (#190)", () => {
		history.replaceState({}, "", "/ap-admin/route-pages/about?error=1");
		const stashKey = `ap-section-editor:${location.pathname}`;
		sessionStorage.setItem(
			stashKey,
			JSON.stringify([{ id: "kept", kind: "hero", headline: "My unsaved work", alignment: "start" }]),
		);
		// Server re-rendered with the (empty) DB copy...
		mount({ sections: [], templates: [] });
		// ...but the editor restores the submitted work.
		const payload = JSON.parse(
			document.querySelector<HTMLInputElement>("#payload")?.value ?? "{}",
		) as { sections: Array<{ headline: string }> };
		expect(payload.sections).toHaveLength(1);
		expect(payload.sections[0].headline).toBe("My unsaved work");
		// Stash is consumed once.
		expect(sessionStorage.getItem(stashKey)).toBeNull();
		history.replaceState({}, "", "/");
	});
});
