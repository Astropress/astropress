function buildPreviewDocument(html: string) {
	return [
		"<!doctype html>",
		'<html lang="en">',
		'<head><meta charset="utf-8"><style>body{font-family:Georgia,serif;padding:1rem;line-height:1.6;color:#17212c}</style></head>',
		"<body>",
		html,
		"</body></html>",
	].join("");
}

function createUrlDialog(): {
	dialog: HTMLDialogElement;
	resolve: (value: string | null) => void;
} {
	let resolveFn: (value: string | null) => void = () => {};
	const dialog = document.createElement("dialog");
	dialog.setAttribute("aria-labelledby", "url-dialog-label");
	dialog.innerHTML = `
    <form method="dialog" class="url-dialog-form">
      <label id="url-dialog-label" for="url-dialog-input">Enter URL</label>
      <input id="url-dialog-input" type="url" name="url" placeholder="https://" autocomplete="off" />
      <div class="url-dialog-actions">
        <button type="submit" value="ok">Insert</button>
        <button type="button" data-cancel>Cancel</button>
      </div>
    </form>`;
	dialog.querySelector("[data-cancel]")?.addEventListener("click", () => {
		dialog.close("");
	});
	dialog.addEventListener("close", () => {
		const val =
			dialog.returnValue === "ok"
				? (dialog.querySelector<HTMLInputElement>("#url-dialog-input")?.value ??
					"")
				: null;
		resolveFn(val || null);
	});
	document.body.appendChild(dialog);
	return {
		dialog,
		get resolve() {
			return resolveFn;
		},
		set resolve(fn) {
			resolveFn = fn;
		},
	} as { dialog: HTMLDialogElement; resolve: (value: string | null) => void };
}

function promptUrl(urlDialog: {
	dialog: HTMLDialogElement;
	resolve: (value: string | null) => void;
}): Promise<string | null> {
	const input =
		urlDialog.dialog.querySelector<HTMLInputElement>("#url-dialog-input");
	if (input) input.value = "";
	return new Promise((resolve) => {
		urlDialog.resolve = resolve;
		urlDialog.dialog.returnValue = "";
		urlDialog.dialog.showModal();
		input?.focus();
	});
}

window.addEventListener("DOMContentLoaded", () => {
	const editor =
		document.querySelector<HTMLTextAreaElement>("[data-body-editor]");
	const preview = document.querySelector<HTMLIFrameElement>(
		".preview-frame iframe",
	);
	const toolbar = document.querySelector<HTMLElement>(
		'[role="toolbar"][aria-label="Format body"]',
	);
	const mediaButton =
		document.querySelector<HTMLButtonElement>(".insert-media-btn");
	const mediaDialog = document.getElementById(
		"media-library-dialog",
	) as HTMLDialogElement | null;
	const mediaClose = document.getElementById("media-dialog-close");
	const urlDialog = createUrlDialog();

	const syncPreview = () => {
		if (!editor || !preview) {
			return;
		}
		preview.srcdoc = buildPreviewDocument(editor.value);
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
		editor.addEventListener("input", syncPreview);
	}

	toolbar?.addEventListener("click", (event) => {
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
			promptUrl(urlDialog).then((url) => {
				if (url) {
					wrapSelection(
						`<a href="${url.replaceAll('"', "&quot;")}">`, // audit-ok: admin-only editor; url is from UI prompt, attribute-breaking chars escaped
						"</a>",
						"Link text",
					);
				}
			});
		}
	});

	mediaButton?.addEventListener("click", () => {
		mediaDialog?.showModal();
	});

	mediaClose?.addEventListener("click", () => {
		mediaDialog?.close();
	});
});
