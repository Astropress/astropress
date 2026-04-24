/**
 * <ap-pending-form> — progressive-enhancement wrapper around a native <form>
 * that surfaces submission state as ARIA + a data attribute within one frame.
 *
 * Usage:
 *   <ap-pending-form>
 *     <form method="post" action="/...">
 *       ...
 *       <button type="submit">Save</button>
 *     </form>
 *   </ap-pending-form>
 *
 * On submit it synchronously (inside the 'submit' event handler, so no async
 * delay) sets:
 *   - `data-pending="true"` on itself
 *   - `aria-busy="true"` on every submit button inside the form
 *   - `disabled` on submit buttons (prevents double-submission)
 *
 * The host form still posts via the browser's native submission pipeline —
 * this only adds the visible pending-state affordance. Rubric 52 requires
 * async-action feedback within 100ms of user intent; doing it synchronously
 * in the submit-event phase gives sub-frame latency in practice.
 */
export class ApPendingForm extends HTMLElement {
	private _onSubmit = (event: Event) => this._handleSubmit(event);
	private _form: HTMLFormElement | null = null;

	connectedCallback() {
		const form = this.querySelector("form");
		if (!form) return;
		this._form = form;
		form.addEventListener("submit", this._onSubmit);
	}

	disconnectedCallback() {
		if (this._form) {
			this._form.removeEventListener("submit", this._onSubmit);
			this._form = null;
		}
	}

	private _handleSubmit(event: Event) {
		// Native form submission isn't cancelled; the browser still posts.
		// We just flip the visible/assistive-tech state synchronously.
		if (event.defaultPrevented) return;
		this.setAttribute("data-pending", "true");
		const buttons = this.querySelectorAll<HTMLButtonElement>(
			'button[type="submit"], button:not([type])',
		);
		for (const button of buttons) {
			button.setAttribute("aria-busy", "true");
			button.disabled = true;
		}
	}
}

customElements.define("ap-pending-form", ApPendingForm);
