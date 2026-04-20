/**
 * <ap-html-editor> — HTML body editor with formatting toolbar, live preview, and media picker.
 *
 * Replaces src/client/post-editor.ts. Key improvement: replaces window.prompt() for URL
 * input with a native <dialog> + <form method="dialog">, which is keyboard-accessible,
 * styleable, and doesn't carry browser-native chrome that could confuse users.
 *
 * Light DOM: the textarea, iframe, toolbar, and dialogs are rendered by the host Astro page.
 * This element finds them by role/data attributes and wires up the interactions.
 *
 * Expected children / descendants:
 *   [data-body-editor]                — <textarea> for the HTML body
 *   .preview-frame iframe             — <iframe sandbox=""> for the live preview
 *   [role="toolbar"][aria-label="Format body"]  — formatting toolbar
 *   .insert-media-btn                 — button to open the media library
 *   #media-library-dialog            — <dialog> for the media picker
 *   #media-dialog-close              — close button inside the media dialog
 *   #url-input-dialog                — <dialog> for URL input (replaces window.prompt)
 *   #url-input-field                 — <input> inside the URL dialog
 *   #url-input-form                  — <form method="dialog"> inside the URL dialog
 *
 * Toolbar buttons carry a data-cmd attribute:
 *   bold | italic | insertUnorderedList | createLink
 *
 * Usage (Astro):
 *   <ap-html-editor>
 *     <textarea data-body-editor name="body">{post.body}</textarea>
 *     <div class="preview-frame"><iframe sandbox="" title="Preview"></iframe></div>
 *     <div role="toolbar" aria-label="Format body">
 *       <button type="button" data-cmd="bold">Bold</button>
 *       <button type="button" data-cmd="italic">Italic</button>
 *       <button type="button" data-cmd="insertUnorderedList">List</button>
 *       <button type="button" data-cmd="createLink">Link</button>
 *     </div>
 *     <button type="button" class="insert-media-btn">Insert media</button>
 *     <!-- URL input dialog (replaces window.prompt) -->
 *     <dialog id="url-input-dialog" aria-labelledby="url-input-title">
 *       <h2 id="url-input-title">Enter URL</h2>
 *       <form id="url-input-form" method="dialog">
 *         <input id="url-input-field" type="url" name="url" placeholder="https://" />
 *         <button type="submit">Insert</button>
 *         <button type="button" data-dialog-close="#url-input-dialog">Cancel</button>
 *       </form>
 *     </dialog>
 *     <!-- Media library dialog -->
 *     <dialog id="media-library-dialog" aria-labelledby="media-dialog-title">
 *       ...
 *       <button id="media-dialog-close">Close</button>
 *     </dialog>
 *   </ap-html-editor>
 */

function buildPreviewDocument(html: string): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		'<head><meta charset="utf-8"><style>body{font-family:Georgia,serif;padding:1rem;line-height:1.6;color:#17212c}</style></head>',
		"<body>",
		html,
		"</body></html>",
	].join("");
}

export class ApHtmlEditor extends HTMLElement {
	private _abortController: AbortController | null = null;
	private _broadcastChannel: BroadcastChannel | null = null;

	private getFocusableElements(container: HTMLElement) {
		return [
			...container.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		].filter((element) => !element.hasAttribute("hidden"));
	}

	connectedCallback() {
		this._abortController = new AbortController();
		const { signal } = this._abortController;

		// Multi-tab safety: warn if this post is already open in another tab
		const slug =
			this.getAttribute("data-slug") ??
			this.querySelector<HTMLFormElement>("form[action]")
				?.action?.split("/")
				.at(-1) ??
			"";

		if (slug && typeof BroadcastChannel !== "undefined") {
			this._broadcastChannel = new BroadcastChannel("ap-editor");
			this._broadcastChannel.postMessage({ slug, ts: Date.now() });
			this._broadcastChannel.addEventListener("message", (event) => {
				if (event.data?.slug === slug) {
					const notice = document.createElement("ap-notice") as HTMLElement;
					notice.setAttribute("type", "error");
					notice.textContent =
						"This post is open in another tab. Save carefully to avoid overwriting changes.";
					this.insertAdjacentElement("afterbegin", notice);
					// Only show once
					this._broadcastChannel?.close();
					this._broadcastChannel = null;
				}
			});
		}

		const editor =
			this.querySelector<HTMLTextAreaElement>("[data-body-editor]");
		const preview = this.querySelector<HTMLIFrameElement>(
			".preview-frame iframe",
		);
		const toolbar = this.querySelector<HTMLElement>(
			'[role="toolbar"][aria-label="Format body"]',
		);
		const mediaButton =
			this.querySelector<HTMLButtonElement>(".insert-media-btn");
		const mediaDialog = this.querySelector<HTMLDialogElement>(
			"#media-library-dialog",
		);
		const mediaClose = this.querySelector<HTMLElement>("#media-dialog-close");
		const urlDialog =
			this.querySelector<HTMLDialogElement>("#url-input-dialog");
		const urlField = this.querySelector<HTMLInputElement>("#url-input-field");
		const urlForm = this.querySelector<HTMLFormElement>("#url-input-form");

		const trapDialogFocus = (
			dialog: HTMLDialogElement,
			event: KeyboardEvent,
		) => {
			if (event.key !== "Tab") {
				return;
			}

			const focusable = this.getFocusableElements(dialog);
			if (focusable.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}

			const first = focusable[0];
			const last = focusable.at(-1) as HTMLElement;
			const active = dialog.ownerDocument.activeElement as HTMLElement | null;

			if (event.shiftKey) {
				if (!active || active === first) {
					event.preventDefault();
					last.focus();
				}
				return;
			}

			if (!active || active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		const prepareDialog = (
			dialog: HTMLDialogElement | null,
			initialFocus?: HTMLElement | null,
			restoreFocus?: HTMLElement | null,
		) => {
			if (!dialog) {
				return;
			}

			dialog.addEventListener(
				"keydown",
				(event) => trapDialogFocus(dialog, event),
				{ signal },
			);
			dialog.addEventListener("close", () => restoreFocus?.focus(), { signal });
			dialog.addEventListener("cancel", () => restoreFocus?.focus(), {
				signal,
			});
			dialog.addEventListener(
				"transitionend",
				() => {
					if (dialog.open) {
						(
							initialFocus ??
							this.getFocusableElements(dialog)[0] ??
							dialog
						).focus();
					}
				},
				{ signal },
			);
		};

		const syncPreview = () => {
			if (editor && preview) {
				preview.srcdoc = buildPreviewDocument(editor.value);
			}
		};

		const wrapSelection = (
			prefix: string,
			suffix: string,
			placeholder: string,
		) => {
			if (!editor) {
				return;
			}
			const start = editor.selectionStart;
			const end = editor.selectionEnd;
			const selected = editor.value.slice(start, end) || placeholder;
			editor.value =
				editor.value.slice(0, start) +
				prefix +
				selected +
				suffix +
				editor.value.slice(end);
			editor.setSelectionRange(
				start + prefix.length,
				start + prefix.length + selected.length,
			);
			editor.focus();
			syncPreview();
		};

		if (editor) {
			syncPreview();
			editor.addEventListener("input", syncPreview, { signal });
		}

		toolbar?.addEventListener(
			"click",
			(event) => {
				const target = event.target;
				if (!(target instanceof Element)) {
					return;
				}
				const button = target.closest<HTMLElement>("[data-cmd]");
				if (!button) {
					return;
				}
				event.preventDefault();
				const cmd = button.getAttribute("data-cmd");

				if (cmd === "bold") {
					wrapSelection("<strong>", "</strong>", "Bold text");
				} else if (cmd === "italic") {
					wrapSelection("<em>", "</em>", "Italic text");
				} else if (cmd === "insertUnorderedList") {
					wrapSelection("<ul>\n  <li>", "</li>\n</ul>", "List item");
				} else if (cmd === "createLink") {
					// Open the URL dialog instead of window.prompt()
					if (urlDialog && urlField) {
						urlField.value = "";
						urlDialog.showModal();
						urlField.focus();
					}
				}
			},
			{ signal },
		);

		// URL dialog: when the form submits (user pressed Insert), apply the URL
		urlForm?.addEventListener(
			"submit",
			() => {
				// <form method="dialog"> closes the dialog on submit and sets dialog.returnValue
				// We read the field value before the browser closes the dialog
				const url = urlField?.value?.trim() ?? "";
				if (url) {
					wrapSelection(
						`<a href="${url.replaceAll('"', "&quot;")}">`,
						"</a>",
						"Link text",
					);
				}
			},
			{ signal },
		);

		// Cancel button inside URL dialog
		urlDialog
			?.querySelector<HTMLElement>("[data-dialog-close]")
			?.addEventListener("click", () => urlDialog.close(), { signal });

		// Media library
		prepareDialog(mediaDialog, mediaClose ?? null, mediaButton ?? null);
		prepareDialog(
			urlDialog,
			urlField ?? null,
			toolbar?.querySelector<HTMLElement>('[data-cmd="createLink"]') ?? null,
		);

		mediaButton?.addEventListener(
			"click",
			() => {
				mediaDialog?.showModal();
				(mediaClose ?? mediaDialog)?.focus();
			},
			{ signal },
		);
		mediaClose?.addEventListener("click", () => mediaDialog?.close(), {
			signal,
		});
	}

	disconnectedCallback() {
		this._abortController?.abort();
		this._abortController = null;
		this._broadcastChannel?.close();
		this._broadcastChannel = null;
	}
}

customElements.define("ap-html-editor", ApHtmlEditor);
