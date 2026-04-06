/**
 * <ap-admin-nav> — mobile sidebar toggle for the admin shell.
 *
 * Expected descendants:
 *   [data-nav-toggle]  — hamburger button in the topbar (one per page)
 *   [data-nav-close]   — close button inside the sidebar (one per page)
 *   nav[data-nav-sidebar] — the sidebar element
 *
 * Behavior:
 *   - Toggle button toggles aria-expanded and data-open on the sidebar.
 *   - Close button and Escape key close the sidebar.
 *   - On desktop (≥901px) no state is managed; sidebar is always visible via CSS.
 */
export class ApAdminNav extends HTMLElement {
  private _abortController: AbortController | null = null;

  connectedCallback() {
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    const toggle = this.querySelector<HTMLButtonElement>("[data-nav-toggle]");
    const close = this.querySelector<HTMLButtonElement>("[data-nav-close]");
    const sidebar = this.querySelector<HTMLElement>("[data-nav-sidebar]");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => this._open(toggle, sidebar), { signal });

    if (close) {
      close.addEventListener("click", () => this._close(toggle, sidebar), { signal });
    }

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && sidebar.hasAttribute("data-open")) {
          this._close(toggle, sidebar);
          toggle.focus();
        }
      },
      { signal },
    );
  }

  disconnectedCallback() {
    this._abortController?.abort();
  }

  private _open(toggle: HTMLButtonElement, sidebar: HTMLElement) {
    sidebar.setAttribute("data-open", "");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", toggle.getAttribute("data-label-close") ?? "Close navigation");
  }

  private _close(toggle: HTMLButtonElement, sidebar: HTMLElement) {
    sidebar.removeAttribute("data-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", toggle.getAttribute("data-label-open") ?? "Open navigation");
  }
}

customElements.define("ap-admin-nav", ApAdminNav);
