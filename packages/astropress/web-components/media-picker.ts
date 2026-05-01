/**
 * <ap-media-picker> — modal media library picker for inputs that hold a media id.
 *
 * Usage (Astro):
 *   <ap-media-picker for="hero-media-input" multiple="false">
 *     <button type="button" data-media-picker-trigger>Choose image</button>
 *   </ap-media-picker>
 *   <input id="hero-media-input" type="text" name="mediaId" />
 *
 * The element looks up the input by id, opens a <dialog>, fetches
 * /ap-admin/api/media, and on selection writes the chosen asset's id back
 * into the input (and dispatches a bubbling `input` event so any framework
 * watching the input picks up the change).
 *
 * Emits `media-picker-select` (CustomEvent { detail: { id, url, title } })
 * when an item is chosen.
 *
 * Light DOM. Builds its own dialog lazily on first open.
 */

interface MediaItem {
	id: string;
	url: string;
	title: string;
	altText: string;
	mimeType: string;
	width: number | null;
	height: number | null;
}

const ENDPOINT = "/ap-admin/api/media";
let cachedItems: MediaItem[] | null = null;

async function fetchItems(): Promise<MediaItem[]> {
	if (cachedItems) return cachedItems;
	const res = await fetch(ENDPOINT, {
		headers: { accept: "application/json" },
		credentials: "same-origin",
	});
	if (!res.ok) {
		throw new Error(`media list: HTTP ${res.status}`);
	}
	const body = (await res.json()) as { items?: MediaItem[] };
	cachedItems = body.items ?? [];
	return cachedItems;
}

export class ApMediaPicker extends HTMLElement {
	private abort: AbortController | null = null;
	private dialog: HTMLDialogElement | null = null;

	connectedCallback() {
		this.abort = new AbortController();
		const { signal } = this.abort;
		const trigger = this.querySelector<HTMLButtonElement>(
			"[data-media-picker-trigger]",
		);
		trigger?.addEventListener("click", () => this.open(), { signal });
	}

	disconnectedCallback() {
		this.abort?.abort();
		this.abort = null;
	}

	private get targetInputId(): string {
		return this.getAttribute("for") ?? "";
	}

	private get isMultiple(): boolean {
		return this.getAttribute("multiple") === "true";
	}

	private async open() {
		if (!this.dialog) {
			this.dialog = document.createElement("dialog");
			this.dialog.className = "ap-media-picker__dialog";
			this.dialog.setAttribute("aria-label", "Media library");
			const labelTitle = escapeText(
				this.getAttribute("data-label-title") ?? "Choose media",
			);
			const labelSearch = escapeAttr(
				this.getAttribute("data-label-search") ?? "Search…",
			);
			const labelClose = escapeAttr(
				this.getAttribute("data-label-close") ?? "Close",
			);
			this.dialog.innerHTML = `
<div class="ap-media-picker__inner">
  <header class="ap-media-picker__head">
    <h3>${labelTitle}</h3>
    <input type="search" placeholder="${labelSearch}" data-media-picker-search />
    <button type="button" data-media-picker-close aria-label="${labelClose}">×</button>
  </header>
  <div class="ap-media-picker__grid" role="list" data-media-picker-grid>
    <p class="ap-media-picker__loading">Loading…</p>
  </div>
</div>`;
			document.body.appendChild(this.dialog);
			this.wireDialog();
		}
		this.dialog.showModal();
		try {
			const items = await fetchItems();
			this.renderItems(items);
		} catch (err) {
			const grid = this.dialog.querySelector<HTMLElement>(
				"[data-media-picker-grid]",
			);
			if (grid)
				grid.innerHTML = `<p class="ap-media-picker__error">${err instanceof Error ? err.message : "Failed to load media"}</p>`;
		}
	}

	private wireDialog() {
		if (!this.dialog) return;
		this.dialog.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			if (target.closest("[data-media-picker-close]")) {
				this.dialog?.close();
				return;
			}
			const item = target.closest<HTMLElement>(".ap-media-picker__item");
			if (item) {
				const id = item.dataset.mediaId ?? "";
				const url = item.dataset.mediaUrl ?? "";
				const title = item.dataset.mediaTitle ?? "";
				this.commitSelection(id, url, title);
			}
		});
		const search = this.dialog.querySelector<HTMLInputElement>(
			"[data-media-picker-search]",
		);
		search?.addEventListener("input", () => this.applyFilter());
	}

	private applyFilter() {
		if (!this.dialog) return;
		const search = this.dialog.querySelector<HTMLInputElement>(
			"[data-media-picker-search]",
		);
		const term = (search?.value ?? "").trim().toLowerCase();
		const items = this.dialog.querySelectorAll<HTMLElement>(
			".ap-media-picker__item",
		);
		for (const el of items) {
			const haystack =
				`${el.dataset.mediaTitle ?? ""} ${el.dataset.mediaAlt ?? ""}`.toLowerCase();
			el.hidden = term.length > 0 && !haystack.includes(term);
		}
	}

	private renderItems(items: MediaItem[]) {
		if (!this.dialog) return;
		const grid = this.dialog.querySelector<HTMLElement>(
			"[data-media-picker-grid]",
		);
		if (!grid) return;
		if (items.length === 0) {
			const labelEmpty = escapeText(
				this.getAttribute("data-label-empty") ?? "No media uploaded yet.",
			);
			grid.innerHTML = `<p class="ap-media-picker__empty">${labelEmpty}</p>`;
			return;
		}
		grid.innerHTML = items
			.map(
				(item) => `
<button type="button" class="ap-media-picker__item" role="listitem"
  data-media-id="${escapeAttr(item.id)}"
  data-media-url="${escapeAttr(item.url)}"
  data-media-title="${escapeAttr(item.title)}"
  data-media-alt="${escapeAttr(item.altText)}">
  <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.altText)}" loading="lazy" decoding="async" />
  <span class="ap-media-picker__caption">${escapeText(item.title || item.id)}</span>
</button>`,
			)
			.join("");
	}

	private commitSelection(id: string, url: string, title: string) {
		const targetId = this.targetInputId;
		if (targetId) {
			const input = document.getElementById(targetId) as
				| HTMLInputElement
				| HTMLTextAreaElement
				| null;
			if (input) {
				if (this.isMultiple) {
					const existing = input.value
						.split(",")
						.map((v) => v.trim())
						.filter((v) => v.length > 0);
					if (!existing.includes(id)) existing.push(id);
					input.value = existing.join(", ");
				} else {
					input.value = id;
				}
				input.dispatchEvent(new Event("input", { bubbles: true }));
				input.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}
		this.dispatchEvent(
			new CustomEvent("media-picker-select", {
				bubbles: true,
				detail: { id, url, title },
			}),
		);
		if (!this.isMultiple) this.dialog?.close();
	}
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
	return value.replace(/[&<>]/g, (ch) => {
		switch (ch) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			default:
				return ch;
		}
	});
}

if (
	typeof customElements !== "undefined" &&
	!customElements.get("ap-media-picker")
) {
	customElements.define("ap-media-picker", ApMediaPicker);
}
