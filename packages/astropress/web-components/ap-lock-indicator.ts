/**
 * <ap-lock-indicator> — Pessimistic content lock for the admin editor.
 *
 * Acquires a server-side lock on mount, heartbeats every 4 minutes,
 * and releases the lock on disconnect. Shows a conflict banner when
 * another user holds the lock.
 *
 * Attributes:
 *   slug          — content slug to lock (required)
 *   acquire-url   — URL to POST to acquire a lock (required)
 *   refresh-url   — URL to POST to heartbeat the lock (required)
 *   release-url   — URL to POST to release the lock (required)
 *   csrf-token    — CSRF token for POST requests (required)
 *
 * @example
 * ```html
 * <ap-lock-indicator
 *   slug="my-post"
 *   acquire-url="/ap-admin/actions/content-lock-acquire"
 *   refresh-url="/ap-admin/actions/content-lock-refresh"
 *   release-url="/ap-admin/actions/content-lock-release"
 *   csrf-token="..."
 * ></ap-lock-indicator>
 * ```
 */
export class ApLockIndicator extends HTMLElement {
  private _lockToken: string | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  async connectedCallback() {
    const slug = this.getAttribute("slug");
    const acquireUrl = this.getAttribute("acquire-url");
    const csrfToken = this.getAttribute("csrf-token");
    if (!slug || !acquireUrl || !csrfToken) return;

    const body = new FormData();
    body.set("slug", slug);
    body.set("_csrf", csrfToken);

    const response = await fetch(acquireUrl, { method: "POST", body });
    if (!response.ok) return;

    const data = (await response.json()) as
      | { ok: true; lockToken: string; expiresAt: string }
      | { ok: false; conflict: true; lockedByName: string; expiresAt: string };

    if (!data.ok && data.conflict) {
      this._showConflict(data.lockedByName, data.expiresAt);
      return;
    }

    if (data.ok) {
      this._lockToken = data.lockToken;
      this._startHeartbeat(slug, csrfToken);
    }
  }

  disconnectedCallback() {
    this._stopHeartbeat();
    const slug = this.getAttribute("slug");
    const releaseUrl = this.getAttribute("release-url");
    const csrfToken = this.getAttribute("csrf-token");
    if (!slug || !releaseUrl || !csrfToken || !this._lockToken) return;

    const body = new FormData();
    body.set("slug", slug);
    body.set("lock_token", this._lockToken);
    body.set("_csrf", csrfToken);
    void fetch(releaseUrl, { method: "POST", body });
  }

  private _startHeartbeat(slug: string, csrfToken: string) {
    const refreshUrl = this.getAttribute("refresh-url");
    if (!refreshUrl) return;

    this._heartbeatTimer = setInterval(async () => {
      if (!this._lockToken) return;
      const body = new FormData();
      body.set("slug", slug);
      body.set("lock_token", this._lockToken);
      body.set("_csrf", csrfToken);
      await fetch(refreshUrl, { method: "POST", body });
    }, 4 * 60 * 1000);
  }

  private _stopHeartbeat() {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _showConflict(lockedByName: string, expiresAt: string) {
    const banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "assertive");
    banner.setAttribute("data-ap-lock-conflict", "true");
    banner.style.cssText =
      "background:var(--ap-color-error-bg,#fff1f0);border:1px solid var(--ap-color-error-border,#ffa39e);padding:0.75rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.875rem;";
    const expiry = new Date(expiresAt).toLocaleTimeString();
    banner.textContent = `Locked by ${lockedByName} — expires ${expiry}`;
    this.appendChild(banner);
  }
}

customElements.define("ap-lock-indicator", ApLockIndicator);
