// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "../../web-components/html-editor";
import type { ApHtmlEditor } from "../../web-components/html-editor";

function stubDialog(dialog: HTMLDialogElement) {
	dialog.showModal = () => dialog.setAttribute("open", "");
	dialog.close = () => dialog.removeAttribute("open");
}

function makeEditor(initialBody = "<p>Hello</p>") {
	const el = document.createElement("ap-html-editor") as ApHtmlEditor;
	// Dialogs are siblings of the main form — not children — to avoid nested-form
	// parsing issues (HTML disallows <form> inside <form>).
	el.innerHTML = `
    <form method="post">
      <div role="toolbar" aria-label="Format body">
        <button type="button" data-cmd="bold">Bold</button>
        <button type="button" data-cmd="italic">Italic</button>
        <button type="button" data-cmd="insertUnorderedList">List</button>
        <button type="button" data-cmd="createLink">Link</button>
        <button type="button" class="insert-media-btn">Media</button>
      </div>
      <textarea data-body-editor name="body" rows="10">${initialBody}</textarea>
      <div class="preview-frame">
        <iframe title="Preview" sandbox=""></iframe>
      </div>
    </form>
    <dialog id="url-input-dialog" aria-labelledby="url-title">
      <h2 id="url-title">Insert link</h2>
      <form id="url-input-form" method="dialog">
        <input id="url-input-field" type="url" name="url" />
        <button type="submit">Insert</button>
        <button type="button" data-dialog-close>Cancel</button>
      </form>
    </dialog>
    <dialog id="media-library-dialog" aria-labelledby="media-title">
      <h2 id="media-title">Media</h2>
      <button id="media-dialog-close" type="button">Close</button>
    </dialog>
  `;
	const urlDialog = el.querySelector("#url-input-dialog") as HTMLDialogElement;
	const mediaDialog = el.querySelector(
		"#media-library-dialog",
	) as HTMLDialogElement;
	stubDialog(urlDialog);
	stubDialog(mediaDialog);

	document.body.appendChild(el);
	return {
		el,
		editor: el.querySelector("[data-body-editor]") as HTMLTextAreaElement,
		iframe: el.querySelector("iframe") as HTMLIFrameElement,
		toolbar: el.querySelector('[role="toolbar"]') as HTMLElement,
		urlDialog,
		mediaDialog,
		urlField: el.querySelector("#url-input-field") as HTMLInputElement,
		urlForm: el.querySelector("#url-input-form") as HTMLFormElement,
		mediaButton: el.querySelector(".insert-media-btn") as HTMLButtonElement,
		mediaClose: el.querySelector("#media-dialog-close") as HTMLButtonElement,
	};
}

describe("ApHtmlEditor", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("is registered as a custom element", () => {
		expect(customElements.get("ap-html-editor")).toBeDefined();
	});

	it("syncs initial body to iframe srcdoc on connect", () => {
		const { iframe } = makeEditor("<p>Hello</p>");
		expect(iframe.srcdoc).toContain("<p>Hello</p>");
		expect(iframe.srcdoc).toContain("<!doctype html>");
	});

	it("updates iframe srcdoc on textarea input", () => {
		const { editor, iframe } = makeEditor("");
		editor.value = "<p>Updated</p>";
		editor.dispatchEvent(new Event("input"));
		expect(iframe.srcdoc).toContain("<p>Updated</p>");
	});

	it("wraps selected text with bold tags on bold button click", () => {
		const { editor, toolbar } = makeEditor("Hello world");
		editor.setSelectionRange(6, 11); // select "world"
		toolbar.querySelector<HTMLButtonElement>('[data-cmd="bold"]')?.click();
		expect(editor.value).toBe("Hello <strong>world</strong>");
	});

	it("wraps selected text with italic tags on italic button click", () => {
		const { editor, toolbar } = makeEditor("Hello world");
		editor.setSelectionRange(0, 5); // select "Hello"
		toolbar.querySelector<HTMLButtonElement>('[data-cmd="italic"]')?.click();
		expect(editor.value).toBe("<em>Hello</em> world");
	});

	it("inserts a list placeholder when no text is selected", () => {
		const { editor, toolbar } = makeEditor("");
		editor.setSelectionRange(0, 0);
		toolbar
			.querySelector<HTMLButtonElement>('[data-cmd="insertUnorderedList"]')
			?.click();
		expect(editor.value).toContain("<ul>");
		expect(editor.value).toContain("<li>");
		expect(editor.value).toContain("List item");
	});

	it("opens URL dialog instead of window.prompt on createLink", () => {
		const { toolbar, urlDialog } = makeEditor("");
		toolbar
			.querySelector<HTMLButtonElement>('[data-cmd="createLink"]')
			?.click();
		expect(urlDialog.getAttribute("open")).toBe("");
	});

	it("inserts link wrapping selection after URL dialog submit", () => {
		const { editor, toolbar, urlField, urlForm } = makeEditor("click here");
		editor.setSelectionRange(0, 10); // select "click here"
		toolbar
			.querySelector<HTMLButtonElement>('[data-cmd="createLink"]')
			?.click();

		urlField.value = "https://example.com";
		urlForm.dispatchEvent(new Event("submit"));

		expect(editor.value).toBe('<a href="https://example.com">click here</a>');
	});

	it("does not insert link when URL field is empty", () => {
		const { editor, toolbar, urlField, urlForm } = makeEditor("click here");
		editor.setSelectionRange(0, 10);
		toolbar
			.querySelector<HTMLButtonElement>('[data-cmd="createLink"]')
			?.click();

		urlField.value = "";
		urlForm.dispatchEvent(new Event("submit"));

		expect(editor.value).toBe("click here");
	});

	it("opens media dialog on media button click", () => {
		const { mediaButton, mediaDialog } = makeEditor("");
		mediaButton.click();
		expect(mediaDialog.getAttribute("open")).toBe("");
	});

	it("closes media dialog on media close button click", () => {
		const { mediaButton, mediaDialog, mediaClose } = makeEditor("");
		mediaButton.click();
		mediaClose.click();
		expect(mediaDialog.getAttribute("open")).toBeNull();
	});

	it("removes event listeners after disconnectedCallback", () => {
		const { el, editor, iframe } = makeEditor("<p>Original</p>");
		document.body.removeChild(el);

		// After disconnect, input events should not update srcdoc
		const previousSrcdoc = iframe.srcdoc;
		editor.value = "<p>Changed after disconnect</p>";
		editor.dispatchEvent(new Event("input"));
		expect(iframe.srcdoc).toBe(previousSrcdoc);
	});
});
