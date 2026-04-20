/**
 * <ap-confirm-dialog> — generic confirmation dialog custom element.
 *
 * Replaces both src/client/comments-dialog.ts and src/client/redirects-dialog.ts
 * with a single reusable element. Wraps a native <dialog> child (light DOM).
 *
 * Attributes (on trigger buttons — not on the WC itself):
 *   data-confirm-trigger         — marks a button as a trigger for this dialog
 *   data-dialog-id               — ID of the <ap-confirm-dialog> (or its dialog child) to open
 *   data-field-name              — name of form input to populate when the dialog opens
 *   data-field-value             — value to set on that form input
 *   data-text-[slot]             — text content to set on element with id="[slot]" when the dialog opens
 *
 * Attributes (on <ap-confirm-dialog>):
 *   dialog-id  — the id attribute to forward to the inner <dialog> element
 *
 * The <dialog> and form markup lives in the host page template (Astro), making it
 * easy to customise labels, form fields, and CSRF tokens per use case.
 *
 * Usage (Astro, replaces redirects dialog):
 *   <ap-confirm-dialog>
 *     <dialog id="confirm-dialog" class="confirm-modal" aria-labelledby="confirm-dialog-title">
 *       <form id="confirm-form" method="post" action="/ap-admin/actions/redirect-delete">
 *         <input type="hidden" name="sourcePath" value="" />
 *         ...
 *       </form>
 *     </dialog>
 *   </ap-confirm-dialog>
 *
 *   <!-- Trigger (can be anywhere on the page): -->
 *   <button
 *     type="button"
 *     data-confirm-trigger
 *     data-dialog-id="confirm-dialog"
 *     data-text-dialog-source={redirect.from}
 *     data-text-dialog-target={redirect.to}
 *     data-field-name="sourcePath"
 *     data-field-value={redirect.from}
 *   >Delete</button>
 *
 * Usage (Astro, replaces comments reject dialog):
 *   <ap-confirm-dialog>
 *     <dialog id="reject-dialog" class="confirm-modal" aria-labelledby="reject-dialog-title">
 *       ...
 *     </dialog>
 *   </ap-confirm-dialog>
 *
 *   <button
 *     type="button"
 *     data-confirm-trigger
 *     data-dialog-id="reject-dialog"
 *     data-text-reject-author={comment.author}
 *     data-text-reject-route={comment.route}
 *     data-field-name="commentId"
 *     data-field-value={comment.id}
 *   >Reject</button>
 */

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(", ");

export class ApConfirmDialog extends HTMLElement {
	private _dialog: HTMLDialogElement | null = null;
	private _abortController: AbortController | null = null;
	private _triggerElement: HTMLElement | null = null;

	connectedCallback() {
		this._dialog = this.querySelector<HTMLDialogElement>("dialog");
		this._abortController = new AbortController();
		const { signal } = this._abortController;

		// Close triggers inside this element
		for (const btn of this.querySelectorAll<HTMLElement>(
			"[data-dialog-close]",
		)) {
			btn.addEventListener("click", () => this._dialog?.close(), { signal });
		}

		// Restore focus to the trigger element when the dialog closes
		this._dialog?.addEventListener(
			"close",
			() => {
				this._triggerElement?.focus();
				this._triggerElement = null;
			},
			{ signal },
		);

		// Triggers anywhere in the document that target this dialog
		const dialogId = this._dialog?.id;
		if (!dialogId) {
			return;
		}

		document.addEventListener(
			"click",
			(event) => {
				const target = event.target;
				if (!(target instanceof Element)) {
					return;
				}
				const trigger = target.closest<HTMLElement>("[data-confirm-trigger]");
				if (!trigger || trigger.getAttribute("data-dialog-id") !== dialogId) {
					return;
				}
				this._openFromTrigger(trigger);
			},
			{ signal },
		);
	}

	disconnectedCallback() {
		this._abortController?.abort();
		this._abortController = null;
	}

	private _openFromTrigger(trigger: HTMLElement) {
		if (!this._dialog) {
			return;
		}

		// Track the element that opened the dialog so focus can be restored on close
		this._triggerElement = trigger;

		// Set text nodes: data-text-[elementId] → element.textContent
		for (const attr of Array.from(trigger.attributes)) {
			if (attr.name.startsWith("data-text-")) {
				const elementId = attr.name.slice("data-text-".length);
				const el = this._dialog.querySelector(`#${elementId}`);
				if (el) {
					el.textContent = attr.value;
				}
			}
		}

		// Set form field: data-field-name + data-field-value → input[name].value
		const fieldName = trigger.getAttribute("data-field-name");
		const fieldValue = trigger.getAttribute("data-field-value") ?? "";
		if (fieldName) {
			const input = this._dialog.querySelector<HTMLInputElement>(
				`input[name="${fieldName}"]`,
			);
			if (input) {
				input.value = fieldValue;
			}
		}

		this._dialog.showModal();

		// Move focus to the first focusable element inside the dialog
		const firstFocusable = this._dialog.querySelector<HTMLElement>(FOCUSABLE);
		firstFocusable?.focus();
	}
}

customElements.define("ap-confirm-dialog", ApConfirmDialog);
