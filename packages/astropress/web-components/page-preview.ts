/**
 * <ap-page-preview> — sandboxed iframe live-preview of the section editor.
 *
 * Watches the parent <ap-section-editor>'s hidden input (or any input
 * referenced via the `for=` attribute), debounces 400ms, and refreshes the
 * iframe srcdoc by calling renderSectionsDocument().
 *
 * Mobile (<1024px): collapses the split layout into Edit / Preview tabs so
 * the editor stays usable on a phone.
 *
 * Light DOM. Builds its own iframe + tabs lazily.
 */

import {
	type PreviewContext,
	renderSectionsDocument,
} from "../src/sections/preview-renderer";
import { parseSections } from "../src/sections/schema";

const DEBOUNCE_MS = 400;
const TAB_BREAKPOINT = 1024;

export class ApPagePreview extends HTMLElement {
	private abort: AbortController | null = null;
	private iframe: HTMLIFrameElement | null = null;
	private debounceHandle: ReturnType<typeof setTimeout> | null = null;
	private input: HTMLInputElement | HTMLTextAreaElement | null = null;
	private tabsRoot: HTMLElement | null = null;
	private context: PreviewContext = {
		mediaUrls: {},
		testimonials: [],
		dir: "ltr",
	};
	private stylesheetUrl: string | null = null;

	connectedCallback() {
		this.abort = new AbortController();
		const { signal } = this.abort;
		const targetId = this.getAttribute("for") ?? "";
		if (targetId) {
			const el = document.getElementById(targetId);
			if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
				this.input = el as HTMLInputElement | HTMLTextAreaElement;
			}
		}
		this.stylesheetUrl = this.getAttribute("stylesheet");
		this.parseContextFromAttr();
		this.buildShell();
		this.refresh();
		// Listen for changes on the underlying section editor's hidden input.
		this.input?.addEventListener("input", () => this.scheduleRefresh(), {
			signal,
		});
		this.input?.addEventListener("change", () => this.scheduleRefresh(), {
			signal,
		});
		// Also listen to bubbling input events from inside the section editor.
		const editorRoot = targetId
			? document.getElementById(targetId)?.closest("ap-section-editor")
			: null;
		editorRoot?.addEventListener("input", () => this.scheduleRefresh(), {
			signal,
		});
		editorRoot?.addEventListener("change", () => this.scheduleRefresh(), {
			signal,
		});
	}

	disconnectedCallback() {
		this.abort?.abort();
		this.abort = null;
		if (this.debounceHandle) {
			clearTimeout(this.debounceHandle);
			this.debounceHandle = null;
		}
	}

	private parseContextFromAttr() {
		const json = this.getAttribute("data-context");
		if (!json) return;
		try {
			const parsed = JSON.parse(json) as Partial<PreviewContext>;
			this.context = {
				mediaUrls: parsed.mediaUrls ?? {},
				testimonials: parsed.testimonials ?? [],
				dir: parsed.dir === "rtl" ? "rtl" : "ltr",
			};
		} catch {
			/* ignore */
		}
	}

	private buildShell() {
		this.classList.add("ap-page-preview");
		this.innerHTML = `
<div class="ap-page-preview__tabs" role="tablist">
  <button type="button" role="tab" data-pp-tab="edit" aria-selected="true">Edit</button>
  <button type="button" role="tab" data-pp-tab="preview" aria-selected="false">Preview</button>
</div>
<div class="ap-page-preview__frame">
  <iframe sandbox="allow-same-origin" title="Preview" loading="lazy"></iframe>
</div>`;
		this.iframe = this.querySelector<HTMLIFrameElement>("iframe");
		this.tabsRoot = this.querySelector<HTMLElement>(".ap-page-preview__tabs");
		this.tabsRoot?.addEventListener("click", (e) => this.onTabClick(e));
		this.applyResponsiveMode();
		window.addEventListener("resize", () => this.applyResponsiveMode(), {
			signal: this.abort?.signal,
		});
	}

	private applyResponsiveMode() {
		const narrow = window.innerWidth < TAB_BREAKPOINT;
		this.toggleAttribute("data-narrow", narrow);
		if (!narrow) {
			// On wide screens, show preview always; tabs hidden
			const editOwner = document
				.getElementById(this.getAttribute("for") ?? "")
				?.closest("ap-section-editor");
			if (editOwner instanceof HTMLElement) {
				editOwner.removeAttribute("data-pp-hidden");
			}
		}
	}

	private onTabClick(e: Event) {
		const target = (e.target as HTMLElement).closest<HTMLElement>(
			"[data-pp-tab]",
		);
		if (!target) return;
		const which = target.dataset.ppTab;
		if (!which) return;
		const tabs =
			this.tabsRoot?.querySelectorAll<HTMLElement>("[data-pp-tab]") ?? [];
		for (const tab of tabs) {
			tab.setAttribute("aria-selected", tab === target ? "true" : "false");
		}
		const editor = document
			.getElementById(this.getAttribute("for") ?? "")
			?.closest("ap-section-editor");
		if (which === "preview") {
			if (editor instanceof HTMLElement)
				editor.setAttribute("data-pp-hidden", "true");
			this.setAttribute("data-pp-active", "preview");
			this.refresh();
		} else {
			if (editor instanceof HTMLElement)
				editor.removeAttribute("data-pp-hidden");
			this.setAttribute("data-pp-active", "edit");
		}
	}

	private scheduleRefresh() {
		if (this.debounceHandle) clearTimeout(this.debounceHandle);
		this.debounceHandle = setTimeout(() => this.refresh(), DEBOUNCE_MS);
	}

	private refresh() {
		if (!this.iframe || !this.input) return;
		const raw = this.input.value;
		if (raw.trim().length === 0) {
			this.iframe.srcdoc = renderSectionsDocument([], this.context, {
				stylesheetUrl: this.stylesheetUrl ?? undefined,
			});
			return;
		}
		let parsed: ReturnType<typeof parseSections>;
		try {
			const obj = JSON.parse(raw) as unknown;
			parsed = parseSections(obj);
		} catch (err) {
			this.iframe.srcdoc = `<!doctype html><html><body><pre style="color:#b91c1c">Preview error: ${String(err)}</pre></body></html>`;
			return;
		}
		if (!parsed.ok) {
			const errors = parsed.errors
				.map((e) => `${e.path}: ${e.message}`)
				.join("\n");
			this.iframe.srcdoc = `<!doctype html><html><body><pre style="color:#b91c1c">${errors}</pre></body></html>`;
			return;
		}
		this.iframe.srcdoc = renderSectionsDocument(parsed.sections, this.context, {
			stylesheetUrl: this.stylesheetUrl ?? undefined,
		});
	}
}

if (
	typeof customElements !== "undefined" &&
	!customElements.get("ap-page-preview")
) {
	customElements.define("ap-page-preview", ApPagePreview);
}
