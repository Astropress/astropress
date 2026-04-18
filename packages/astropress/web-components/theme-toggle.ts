/**
 * <ap-theme-toggle> — light/dark mode toggle custom element.
 *
 * Attributes:
 *   label-dark  — aria-label shown when theme is currently light (clicking switches to dark)
 *   label-light — aria-label shown when theme is currently dark (clicking switches to light)
 *
 * The element renders its children as-is (light DOM). The host page should place a
 * <button> child (or other interactive content) inside; the WC wires up the click handler.
 *
 * Works with the existing data-theme attribute on <html> and localStorage "theme" key.
 * CSS variables in AdminLayout.astro respond to html[data-theme="dark"] — no shadow DOM needed.
 *
 * Usage (Astro):
 *   <ap-theme-toggle label-dark={adminUi.labels.themeToggleDark} label-light={adminUi.labels.themeToggleLight}>
 *     <button type="button" class="theme-toggle-admin" aria-pressed="false">
 *       <span class="theme-toggle-icon" aria-hidden="true"></span>
 *     </button>
 *   </ap-theme-toggle>
 */

function preferredTheme(): "dark" | "light" {
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readCurrentTheme(): "dark" | "light" {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function applyGlobalTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem("theme", theme);
  } catch {}
}

export class ApThemeToggle extends HTMLElement {
  private _button: HTMLButtonElement | null = null;
  private _icon: HTMLElement | null = null;
  private _handleClick = () => this._toggle();

  connectedCallback() {
    this._button = this.querySelector<HTMLButtonElement>("button");
    this._icon = this.querySelector<HTMLElement>(".theme-toggle-icon");

    // Apply the preferred theme to the page immediately (avoids FOUC when multiple toggles exist)
    const initial = preferredTheme();
    applyGlobalTheme(initial);
    this._syncButton(initial);

    this._button?.addEventListener("click", this._handleClick);
  }

  disconnectedCallback() {
    this._button?.removeEventListener("click", this._handleClick);
  }

  private _toggle() {
    const next = readCurrentTheme() === "dark" ? "light" : "dark";
    applyGlobalTheme(next);
    // Sync all toggle instances on the page
    document.querySelectorAll<ApThemeToggle>("ap-theme-toggle").forEach((el) => el._syncButton(next));
  }

  private _syncButton(theme: "dark" | "light") {
    const isDark = theme === "dark";
    const labelDark = this.getAttribute("label-dark") || "Switch to dark mode";
    const labelLight = this.getAttribute("label-light") || "Switch to light mode";
    const label = isDark ? labelLight : labelDark;

    if (this._button) {
      this._button.setAttribute("aria-pressed", isDark ? "true" : "false");
      this._button.setAttribute("aria-label", label);
      this._button.setAttribute("title", label);
    }
    if (this._icon) {
      this._icon.innerHTML = isDark
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
  }
}

customElements.define("ap-theme-toggle", ApThemeToggle);
