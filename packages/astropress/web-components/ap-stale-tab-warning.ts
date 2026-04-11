/**
 * <ap-stale-tab-warning> — Detects when another browser tab is already editing
 * the same post and shows a warning banner to prevent lost writes.
 *
 * Uses the BroadcastChannel API so all tabs on the same origin communicate
 * without a server round-trip.
 *
 * Attributes:
 *   post-slug       — the slug of the post being edited (required)
 *   opened-at       — Unix ms timestamp when this edit session started (required)
 *   session-ttl-ms  — max session duration before a reload warning; default 3600000 (1 hour)
 *
 * @example
 * ```html
 * <ap-stale-tab-warning post-slug="hello-world" opened-at="1714000000000"></ap-stale-tab-warning>
 * ```
 */
export class ApStaleTabWarning extends HTMLElement {
  private _channel: BroadcastChannel | null = null;
  private _tabId: string = crypto.randomUUID();
  private _ttlTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    const slug = this.getAttribute("post-slug");
    if (!slug) return;

    const openedAt = Number(this.getAttribute("opened-at") ?? Date.now());
    const sessionTtlMs = Number(this.getAttribute("session-ttl-ms") ?? 3_600_000);

    this._channel = new BroadcastChannel("astropress-editor");

    // Announce presence to other tabs editing this slug
    this._channel.postMessage({ type: "editing", slug, id: this._tabId });

    this._channel.addEventListener("message", (event: MessageEvent) => {
      const { type, slug: msgSlug, id } = event.data as {
        type: string;
        slug: string;
        id: string;
      };

      if (msgSlug !== slug) return;

      if (type === "editing" && id !== this._tabId) {
        this._showWarning(
          "Another tab is editing this post. Save your changes first before switching tabs.",
        );
      }

      if (type === "left" && id !== this._tabId) {
        this._clearWarning();
      }
    });

    // Session TTL check — warn if the page has been open too long without reloading
    const elapsed = Date.now() - openedAt;
    const remaining = sessionTtlMs - elapsed;

    if (remaining <= 0) {
      this._showStaleSessionWarning();
    } else {
      this._ttlTimer = setTimeout(() => this._showStaleSessionWarning(), remaining);
    }

    // Inform other open tabs that this tab just opened
    this._channel.postMessage({ type: "editing", slug, id: this._tabId });
  }

  disconnectedCallback() {
    const slug = this.getAttribute("post-slug");
    if (slug && this._channel) {
      this._channel.postMessage({ type: "left", slug, id: this._tabId });
      this._channel.close();
      this._channel = null;
    }

    if (this._ttlTimer !== null) {
      clearTimeout(this._ttlTimer);
      this._ttlTimer = null;
    }
  }

  private _showWarning(message: string) {
    this._clearWarning();
    const banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("data-ap-stale-warning", "tab");
    banner.style.cssText =
      "background:var(--ap-color-warning,#fffbe6);border:1px solid var(--ap-color-warning-border,#ffe58f);padding:0.75rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.875rem;";
    banner.textContent = message;
    this.appendChild(banner);
  }

  private _showStaleSessionWarning() {
    this._showWarning(
      "This page has been open over an hour. Reload before saving to avoid overwriting recent changes.",
    );
  }

  private _clearWarning() {
    const existing = this.querySelector("[data-ap-stale-warning]");
    existing?.remove();
  }
}

customElements.define("ap-stale-tab-warning", ApStaleTabWarning);
