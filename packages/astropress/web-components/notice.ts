/**
 * <ap-notice> — self-dismissing status banner for the admin UI.
 *
 * Usage:
 *   <ap-notice type="success" dismiss-after="5000">Redirect rule saved.</ap-notice>
 *   <ap-notice type="error">Failed to delete comment.</ap-notice>
 *   <ap-notice type="info">No changes were made.</ap-notice>
 *
 * Attributes:
 *   type          "success" | "error" | "info"  (default: "info")
 *   dismiss-after  milliseconds until the element removes itself (optional)
 *
 * CSS: styled via ap-notice[type="success"] / [type="error"] / [type="info"]
 * in AdminLayout.astro.
 */
export class ApNotice extends HTMLElement {
	private _timer: ReturnType<typeof setTimeout> | null = null;

	connectedCallback() {
		const dismissAfter = this.getAttribute("dismiss-after");
		if (dismissAfter) {
			const ms = Number.parseInt(dismissAfter, 10);
			if (!Number.isNaN(ms) && ms > 0) {
				this._timer = setTimeout(() => this.remove(), ms);
			}
		}

		// Allow keyboard dismiss with Escape
		this.setAttribute("role", "status");
		this.setAttribute("aria-live", "polite");
		this.setAttribute("tabindex", "-1");
	}

	disconnectedCallback() {
		if (this._timer !== null) {
			clearTimeout(this._timer);
			this._timer = null;
		}
	}
}

customElements.define("ap-notice", ApNotice);
