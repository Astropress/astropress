/**
 * <ap-section-editor> — visual editor for the structured page sections.
 *
 * Replaces the raw JSON textarea for `cms_route_variants.sections_json`.
 * Renders the current sections as a vertical list of cards, each with a
 * collapsible per-kind form, drag handle, move/duplicate/delete buttons,
 * and a hidden <input name="sectionsJson"> that holds the serialised
 * payload submitted with the form.
 *
 * Light DOM. The element expects:
 *   - `<script type="application/json" data-section-editor-state>...</script>`
 *     containing { sections: Section[], templates: TemplateCatalogEntry[] }.
 *   - `<input type="hidden" name="sectionsJson" data-section-editor-input>`.
 *   - `<div data-section-editor-list></div>` as the cards mount point.
 *   - `<button data-section-editor-add>` to open the add dialog.
 *   - `<dialog data-section-editor-add-dialog>` containing the picker UI.
 *
 * Optional `data-label-*` attributes on the host element provide translated
 * strings (see resolveLabels()).
 *
 * The component is intentionally self-contained: it doesn't reach into
 * the surrounding form, doesn't depend on any CSS framework, and writes
 * back to the hidden input on every change so a normal form submit
 * sends the latest payload.
 */

import type { CtaButton, FaqItem, FeatureItem, Section, SectionKind } from "../src/sections/schema";
import { SECTION_KINDS } from "../src/sections/schema";
import type { TemplateCatalogEntry } from "../src/sections/templates";

type AnySection = Section;

interface EditorState {
	sections: AnySection[];
	templates: TemplateCatalogEntry[];
}

interface EditorLabels {
	addSection: string;
	addDialogTitle: string;
	addDialogClose: string;
	templatesHeading: string;
	sectionsHeading: string;
	moveUp: string;
	moveDown: string;
	duplicate: string;
	delete: string;
	deleteConfirm: string;
	emptyState: string;
	dragHandle: string;
	kind: Record<SectionKind, string>;
	field: Record<string, string>;
	template: Record<string, { title: string; description: string }>;
}

function uuid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultsForKind(kind: SectionKind): AnySection {
	const id = uuid();
	switch (kind) {
		case "hero":
			return { id, kind, headline: "", alignment: "start" };
		case "feature-grid":
			return { id, kind, heading: "", columns: 3, items: [] };
		case "testimonials":
			return { id, kind, source: "featured", layout: "grid" };
		case "cta-banner":
			return {
				id,
				kind,
				headline: "",
				primaryCta: { label: "", href: "" },
				tone: "neutral",
			};
		case "image-text":
			return {
				id,
				kind,
				heading: "",
				body: "",
				mediaId: "",
				imageSide: "start",
			};
		case "faq":
			return { id, kind, items: [] };
		case "gallery":
			return { id, kind, mediaIds: [], columns: 3 };
		case "rich-text":
			return { id, kind, html: "" };
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function parseInitialState(host: HTMLElement): EditorState {
	const script = host.querySelector<HTMLScriptElement>(
		"script[type='application/json'][data-section-editor-state]",
	);
	if (!script) return { sections: [], templates: [] };
	try {
		const parsed = JSON.parse(script.textContent ?? "{}") as Partial<EditorState>;
		return {
			sections: Array.isArray(parsed.sections) ? parsed.sections : [],
			templates: Array.isArray(parsed.templates) ? parsed.templates : [],
		};
	} catch {
		return { sections: [], templates: [] };
	}
}

function resolveLabels(host: HTMLElement): EditorLabels {
	const get = (key: string, fallback: string) => host.dataset[key] ?? fallback;
	const kindFallback: Record<SectionKind, string> = {
		hero: "Hero",
		"feature-grid": "Feature grid",
		testimonials: "Testimonials",
		"cta-banner": "Call-to-action",
		"image-text": "Image + text",
		faq: "FAQ",
		gallery: "Gallery",
		"rich-text": "Rich text",
	};
	const kind: Record<SectionKind, string> = { ...kindFallback };
	for (const k of SECTION_KINDS) {
		const v = host.dataset[`labelKind${toPascal(k)}`];
		if (v) kind[k] = v;
	}
	const tplJson = host.dataset.labelTemplates;
	let template: EditorLabels["template"] = {};
	if (tplJson) {
		try {
			template = JSON.parse(tplJson) as EditorLabels["template"];
		} catch {
			/* ignore */
		}
	}
	const fieldJson = host.dataset.labelFields;
	let field: Record<string, string> = {};
	if (fieldJson) {
		try {
			field = JSON.parse(fieldJson) as Record<string, string>;
		} catch {
			/* ignore */
		}
	}
	return {
		addSection: get("labelAddSection", "Add section"),
		addDialogTitle: get("labelAddDialogTitle", "Add a section"),
		addDialogClose: get("labelAddDialogClose", "Close"),
		templatesHeading: get("labelTemplatesHeading", "Start from a template"),
		sectionsHeading: get("labelSectionsHeading", "Or pick a section type"),
		moveUp: get("labelMoveUp", "Move up"),
		moveDown: get("labelMoveDown", "Move down"),
		duplicate: get("labelDuplicate", "Duplicate"),
		delete: get("labelDelete", "Delete"),
		deleteConfirm: get("labelDeleteConfirm", "Delete this section? This cannot be undone."),
		emptyState: get("labelEmptyState", "No sections yet. Add one to get started."),
		dragHandle: get("labelDragHandle", "Drag to reorder"),
		kind,
		field,
		template,
	};
}

function toPascal(kind: string): string {
	return kind
		.split("-")
		.map((p) => (p.length === 0 ? "" : p[0].toUpperCase() + p.slice(1)))
		.join("");
}

export class ApSectionEditor extends HTMLElement {
	private state: EditorState = { sections: [], templates: [] };
	private labels: EditorLabels = resolveLabels(document.createElement("div"));
	private list: HTMLElement | null = null;
	private hiddenInput: HTMLInputElement | null = null;
	private addBtn: HTMLButtonElement | null = null;
	private addDialog: HTMLDialogElement | null = null;
	private abort: AbortController | null = null;
	private dragSourceId: string | null = null;

	connectedCallback() {
		this.abort = new AbortController();
		const { signal } = this.abort;
		this.state = parseInitialState(this);
		this.labels = resolveLabels(this);
		this.list = this.querySelector<HTMLElement>("[data-section-editor-list]");
		this.hiddenInput = this.querySelector<HTMLInputElement>("[data-section-editor-input]");
		this.addBtn = this.querySelector<HTMLButtonElement>("[data-section-editor-add]");
		this.addDialog = this.querySelector<HTMLDialogElement>("[data-section-editor-add-dialog]");
		if (!this.list || !this.hiddenInput) return;

		this.renderAll();
		this.syncHiddenInput();

		this.addBtn?.addEventListener("click", () => this.openAddDialog(), {
			signal,
		});

		// Delegated handlers on the list for action buttons + drag.
		this.list.addEventListener("click", (e) => this.onListClick(e), { signal });
		this.list.addEventListener("input", (e) => this.onListInput(e), { signal });
		this.list.addEventListener("change", (e) => this.onListInput(e), {
			signal,
		});
		this.list.addEventListener("dragstart", (e) => this.onDragStart(e), {
			signal,
		});
		this.list.addEventListener("dragover", (e) => this.onDragOver(e), {
			signal,
		});
		this.list.addEventListener("drop", (e) => this.onDrop(e), { signal });
		this.list.addEventListener("dragend", () => this.clearDragState(), {
			signal,
		});

		this.addDialog?.addEventListener("click", (e) => this.onAddDialogClick(e), {
			signal,
		});
	}

	disconnectedCallback() {
		this.abort?.abort();
		this.abort = null;
	}

	private syncHiddenInput() {
		if (!this.hiddenInput) return;
		this.hiddenInput.value = JSON.stringify({ sections: this.state.sections });
	}

	private renderAll() {
		if (!this.list) return;
		if (this.state.sections.length === 0) {
			this.list.innerHTML = `<p class="ap-section-editor__empty">${escapeHtml(this.labels.emptyState)}</p>`;
			return;
		}
		this.list.innerHTML = this.state.sections.map((section) => this.renderCard(section)).join("");
	}

	private renderCard(section: AnySection): string {
		const kindLabel = this.labels.kind[section.kind] ?? section.kind;
		return `
<article class="ap-section-card" data-section-id="${escapeHtml(section.id)}" draggable="true">
  <header class="ap-section-card__head">
    <button type="button" class="ap-section-card__handle" aria-label="${escapeHtml(this.labels.dragHandle)}" data-action="handle">⋮⋮</button>
    <span class="ap-section-card__kind">${escapeHtml(kindLabel)}</span>
    <div class="ap-section-card__actions">
      <button type="button" data-action="move-up" aria-label="${escapeHtml(this.labels.moveUp)}">▲</button>
      <button type="button" data-action="move-down" aria-label="${escapeHtml(this.labels.moveDown)}">▼</button>
      <button type="button" data-action="duplicate" aria-label="${escapeHtml(this.labels.duplicate)}">⎘</button>
      <button type="button" data-action="delete" aria-label="${escapeHtml(this.labels.delete)}">✕</button>
    </div>
  </header>
  <div class="ap-section-card__body">${this.renderForm(section)}</div>
</article>`;
	}

	private renderForm(section: AnySection): string {
		switch (section.kind) {
			case "hero":
				return this.renderHeroForm(section);
			case "feature-grid":
				return this.renderFeatureGridForm(section);
			case "testimonials":
				return this.renderTestimonialsForm(section);
			case "cta-banner":
				return this.renderCtaForm(section);
			case "image-text":
				return this.renderImageTextForm(section);
			case "faq":
				return this.renderFaqForm(section);
			case "gallery":
				return this.renderGalleryForm(section);
			case "rich-text":
				return this.renderRichTextForm(section);
		}
	}

	private fieldLabel(key: string, fallback: string): string {
		return this.labels.field[key] ?? fallback;
	}

	private renderHeroForm(s: import("../src/sections/schema").HeroSection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("headline", "Headline"))}</span>
  <input class="admin-input" data-field="headline" type="text" value="${escapeHtml(s.headline)}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("subhead", "Subhead"))}</span>
  <input class="admin-input" data-field="subhead" type="text" value="${escapeHtml(s.subhead ?? "")}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("alignment", "Alignment"))}</span>
  <select class="admin-input" data-field="alignment">
    <option value="start"${s.alignment === "start" ? " selected" : ""}>${escapeHtml(this.fieldLabel("alignmentStart", "Start"))}</option>
    <option value="center"${s.alignment === "center" ? " selected" : ""}>${escapeHtml(this.fieldLabel("alignmentCenter", "Center"))}</option>
  </select></label>
${this.renderMediaIdField(`media-${s.id}`, s.mediaId ?? "", "mediaId")}
${this.renderCtaInputs("primaryCta", s.primaryCta)}
${this.renderCtaInputs("secondaryCta", s.secondaryCta)}
`;
	}

	private renderMediaIdField(
		inputId: string,
		value: string,
		field: string,
		multiple = false,
	): string {
		return `
<div class="admin-field">
  <span>${escapeHtml(this.fieldLabel(field, field === "mediaIds" ? "Media ids" : "Media id"))}</span>
  <div class="ap-section-card__media-row">
    <input id="${escapeHtml(inputId)}" class="admin-input" data-field="${escapeHtml(field)}" type="text" value="${escapeHtml(value)}" />
    <ap-media-picker for="${escapeHtml(inputId)}" multiple="${multiple ? "true" : "false"}">
      <button type="button" class="admin-button-ghost" data-media-picker-trigger>${escapeHtml(this.fieldLabel("pickMedia", "Pick from library"))}</button>
    </ap-media-picker>
  </div>
</div>`;
	}

	private renderCtaInputs(prefix: string, cta?: CtaButton): string {
		const label = cta?.label ?? "";
		const href = cta?.href ?? "";
		return `
<fieldset class="ap-section-card__fieldset">
  <legend>${escapeHtml(this.fieldLabel(prefix, prefix))}</legend>
  <label class="admin-field"><span>${escapeHtml(this.fieldLabel("ctaLabel", "Button label"))}</span>
    <input class="admin-input" data-field="${prefix}.label" type="text" value="${escapeHtml(label)}" /></label>
  <label class="admin-field"><span>${escapeHtml(this.fieldLabel("ctaHref", "Button href"))}</span>
    <input class="admin-input" data-field="${prefix}.href" type="text" value="${escapeHtml(href)}" /></label>
</fieldset>`;
	}

	private renderFeatureGridForm(s: import("../src/sections/schema").FeatureGridSection): string {
		const renderItem = (
			item: { title?: string; body?: string; icon?: string },
			idx: number,
		): string => {
			const fLabel = (k: string, fb: string) => escapeHtml(this.fieldLabel(k, fb));
			const title = escapeHtml(item.title ?? "");
			const body = escapeHtml(item.body ?? "");
			const icon = escapeHtml(item.icon ?? "");
			// nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
			return `<fieldset class="ap-section-card__fieldset" data-item-index="${idx}"><legend>${fLabel("featureItem", "Feature")} ${idx + 1}</legend><label class="admin-field"><span>${fLabel("featureTitle", "Title")}</span><input class="admin-input" data-field="items[${idx}].title" type="text" value="${title}" /></label><label class="admin-field"><span>${fLabel("featureBody", "Body")}</span><input class="admin-input" data-field="items[${idx}].body" type="text" value="${body}" /></label><label class="admin-field"><span>${fLabel("featureIcon", "Icon (emoji or symbol)")}</span><input class="admin-input" data-field="items[${idx}].icon" type="text" value="${icon}" /></label><button type="button" class="admin-button-secondary" data-action="remove-item" data-item-index="${idx}">${fLabel("removeItem", "Remove")}</button></fieldset>`;
		};
		const items = s.items.map(renderItem).join("");
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("heading", "Heading"))}</span>
  <input class="admin-input" data-field="heading" type="text" value="${escapeHtml(s.heading)}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("intro", "Intro"))}</span>
  <input class="admin-input" data-field="intro" type="text" value="${escapeHtml(s.intro ?? "")}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("columns", "Columns"))}</span>
  <select class="admin-input" data-field="columns">
    ${[2, 3, 4].map((n) => `<option value="${n}"${s.columns === n ? " selected" : ""}>${n}</option>`).join("")}
  </select></label>
${items}
<button type="button" class="admin-button-secondary" data-action="add-item">${escapeHtml(this.fieldLabel("addItem", "Add feature"))}</button>
`;
	}

	private renderTestimonialsForm(s: import("../src/sections/schema").TestimonialsSection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("heading", "Heading"))}</span>
  <input class="admin-input" data-field="heading" type="text" value="${escapeHtml(s.heading ?? "")}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("source", "Source"))}</span>
  <select class="admin-input" data-field="source">
    <option value="featured"${s.source === "featured" ? " selected" : ""}>${escapeHtml(this.fieldLabel("sourceFeatured", "Featured testimonials"))}</option>
    <option value="approved"${s.source === "approved" ? " selected" : ""}>${escapeHtml(this.fieldLabel("sourceApproved", "All approved testimonials"))}</option>
    <option value="ids"${s.source === "ids" ? " selected" : ""}>${escapeHtml(this.fieldLabel("sourceIds", "Specific ids"))}</option>
  </select></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("ids", "Testimonial ids (comma-separated)"))}</span>
  <input class="admin-input" data-field="ids" type="text" value="${escapeHtml((s.ids ?? []).join(", "))}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("layout", "Layout"))}</span>
  <select class="admin-input" data-field="layout">
    <option value="grid"${s.layout === "grid" ? " selected" : ""}>${escapeHtml(this.fieldLabel("layoutGrid", "Grid"))}</option>
    <option value="carousel"${s.layout === "carousel" ? " selected" : ""}>${escapeHtml(this.fieldLabel("layoutCarousel", "Carousel"))}</option>
  </select></label>`;
	}

	private renderCtaForm(s: import("../src/sections/schema").CtaBannerSection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("headline", "Headline"))}</span>
  <input class="admin-input" data-field="headline" type="text" value="${escapeHtml(s.headline)}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("body", "Body"))}</span>
  <input class="admin-input" data-field="body" type="text" value="${escapeHtml(s.body ?? "")}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("tone", "Tone"))}</span>
  <select class="admin-input" data-field="tone">
    <option value="neutral"${s.tone === "neutral" ? " selected" : ""}>${escapeHtml(this.fieldLabel("toneNeutral", "Neutral"))}</option>
    <option value="accent"${s.tone === "accent" ? " selected" : ""}>${escapeHtml(this.fieldLabel("toneAccent", "Accent"))}</option>
  </select></label>
${this.renderCtaInputs("primaryCta", s.primaryCta)}
${this.renderCtaInputs("secondaryCta", s.secondaryCta)}
`;
	}

	private renderImageTextForm(s: import("../src/sections/schema").ImageTextSection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("heading", "Heading"))}</span>
  <input class="admin-input" data-field="heading" type="text" value="${escapeHtml(s.heading)}" /></label>
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("body", "Body (HTML)"))}</span>
  <textarea class="admin-textarea" data-field="body" rows="6">${escapeHtml(s.body)}</textarea></label>
${this.renderMediaIdField(`media-${s.id}`, s.mediaId, "mediaId")}
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("imageSide", "Image side"))}</span>
  <select class="admin-input" data-field="imageSide">
    <option value="start"${s.imageSide === "start" ? " selected" : ""}>${escapeHtml(this.fieldLabel("sideStart", "Start"))}</option>
    <option value="end"${s.imageSide === "end" ? " selected" : ""}>${escapeHtml(this.fieldLabel("sideEnd", "End"))}</option>
  </select></label>`;
	}

	private renderFaqForm(s: import("../src/sections/schema").FaqSection): string {
		const items = s.items
			.map(
				(item, idx) => `
<fieldset class="ap-section-card__fieldset" data-item-index="${idx}">
  <legend>${escapeHtml(this.fieldLabel("faqItem", "Question"))} ${idx + 1}</legend>
  <label class="admin-field"><span>${escapeHtml(this.fieldLabel("faqQuestion", "Question"))}</span>
    <input class="admin-input" data-field="items[${idx}].question" type="text" value="${escapeHtml(item.question)}" /></label>
  <label class="admin-field"><span>${escapeHtml(this.fieldLabel("faqAnswer", "Answer"))}</span>
    <textarea class="admin-textarea" data-field="items[${idx}].answer" rows="3">${escapeHtml(item.answer)}</textarea></label>
  <button type="button" class="admin-button-secondary" data-action="remove-item" data-item-index="${idx}">${escapeHtml(this.fieldLabel("removeItem", "Remove"))}</button>
</fieldset>`,
			)
			.join("");
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("heading", "Heading"))}</span>
  <input class="admin-input" data-field="heading" type="text" value="${escapeHtml(s.heading ?? "")}" /></label>
${items}
<button type="button" class="admin-button-secondary" data-action="add-item">${escapeHtml(this.fieldLabel("addItem", "Add question"))}</button>`;
	}

	private renderGalleryForm(s: import("../src/sections/schema").GallerySection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("heading", "Heading"))}</span>
  <input class="admin-input" data-field="heading" type="text" value="${escapeHtml(s.heading ?? "")}" /></label>
${this.renderMediaIdField(`media-${s.id}`, s.mediaIds.join(", "), "mediaIds", true)}
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("columns", "Columns"))}</span>
  <select class="admin-input" data-field="columns">
    ${[2, 3, 4].map((n) => `<option value="${n}"${s.columns === n ? " selected" : ""}>${n}</option>`).join("")}
  </select></label>`;
	}

	private renderRichTextForm(s: import("../src/sections/schema").RichTextSection): string {
		return `
<label class="admin-field"><span>${escapeHtml(this.fieldLabel("html", "HTML"))}</span>
  <textarea class="admin-textarea" data-field="html" rows="10">${escapeHtml(s.html)}</textarea></label>`;
	}

	private onListClick(e: Event) {
		const target = e.target as HTMLElement;
		const action = target.closest<HTMLElement>("[data-action]");
		if (!action) return;
		const card = action.closest<HTMLElement>(".ap-section-card");
		const id = card?.dataset.sectionId;
		if (!id) return;
		switch (action.dataset.action) {
			case "move-up":
				this.moveSection(id, -1);
				break;
			case "move-down":
				this.moveSection(id, +1);
				break;
			case "duplicate":
				this.duplicateSection(id);
				break;
			case "delete":
				if (window.confirm(this.labels.deleteConfirm)) this.deleteSection(id);
				break;
			case "add-item":
				this.addItem(id);
				break;
			case "remove-item": {
				const idx = Number.parseInt(action.dataset.itemIndex ?? "-1", 10);
				if (idx >= 0) this.removeItem(id, idx);
				break;
			}
		}
	}

	private onListInput(e: Event) {
		const input = e.target as HTMLElement;
		const fieldEl = input.closest<HTMLElement>("[data-field]");
		if (!fieldEl) return;
		const card = input.closest<HTMLElement>(".ap-section-card");
		const id = card?.dataset.sectionId;
		if (!id) return;
		const field = fieldEl.getAttribute("data-field") ?? "";
		const value = (input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
		this.updateField(id, field, value);
	}

	private onDragStart(e: DragEvent) {
		const card = (e.target as HTMLElement | null)?.closest<HTMLElement>(".ap-section-card");
		if (!card) return;
		this.dragSourceId = card.dataset.sectionId ?? null;
		card.classList.add("ap-section-card--dragging");
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	}

	private onDragOver(e: DragEvent) {
		if (!this.dragSourceId) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
	}

	private onDrop(e: DragEvent) {
		if (!this.dragSourceId) return;
		e.preventDefault();
		const card = (e.target as HTMLElement | null)?.closest<HTMLElement>(".ap-section-card");
		const targetId = card?.dataset.sectionId;
		if (!targetId || targetId === this.dragSourceId) {
			this.clearDragState();
			return;
		}
		const fromIdx = this.state.sections.findIndex((s) => s.id === this.dragSourceId);
		const toIdx = this.state.sections.findIndex((s) => s.id === targetId);
		if (fromIdx < 0 || toIdx < 0) {
			this.clearDragState();
			return;
		}
		const [moved] = this.state.sections.splice(fromIdx, 1);
		this.state.sections.splice(toIdx, 0, moved);
		this.clearDragState();
		this.renderAll();
		this.syncHiddenInput();
	}

	private clearDragState() {
		this.dragSourceId = null;
		const dragging = this.list?.querySelectorAll<HTMLElement>(".ap-section-card--dragging") ?? [];
		for (const el of dragging) {
			el.classList.remove("ap-section-card--dragging");
		}
	}

	private updateField(id: string, field: string, value: string) {
		const section = this.state.sections.find((s) => s.id === id);
		if (!section) return;
		applyField(section, field, value);
		this.syncHiddenInput();
	}

	private moveSection(id: string, delta: number) {
		const idx = this.state.sections.findIndex((s) => s.id === id);
		if (idx < 0) return;
		const newIdx = idx + delta;
		if (newIdx < 0 || newIdx >= this.state.sections.length) return;
		const [moved] = this.state.sections.splice(idx, 1);
		this.state.sections.splice(newIdx, 0, moved);
		this.renderAll();
		this.syncHiddenInput();
	}

	private duplicateSection(id: string) {
		const idx = this.state.sections.findIndex((s) => s.id === id);
		if (idx < 0) return;
		const original = this.state.sections[idx];
		const copy = JSON.parse(JSON.stringify(original)) as AnySection;
		copy.id = uuid();
		this.state.sections.splice(idx + 1, 0, copy);
		this.renderAll();
		this.syncHiddenInput();
	}

	private deleteSection(id: string) {
		this.state.sections = this.state.sections.filter((s) => s.id !== id);
		this.renderAll();
		this.syncHiddenInput();
	}

	private addItem(id: string) {
		const section = this.state.sections.find((s) => s.id === id);
		if (!section) return;
		if (section.kind === "feature-grid") {
			section.items.push({ title: "", body: "" } as FeatureItem);
		} else if (section.kind === "faq") {
			section.items.push({ question: "", answer: "" } as FaqItem);
		} else {
			return;
		}
		this.renderAll();
		this.syncHiddenInput();
	}

	private removeItem(id: string, index: number) {
		const section = this.state.sections.find((s) => s.id === id);
		if (!section) return;
		if (section.kind === "feature-grid" || section.kind === "faq") {
			section.items.splice(index, 1);
			this.renderAll();
			this.syncHiddenInput();
		}
	}

	private openAddDialog() {
		if (!this.addDialog) return;
		this.populateAddDialog();
		this.addDialog.showModal();
	}

	private populateAddDialog() {
		if (!this.addDialog) return;
		const tplList = this.addDialog.querySelector<HTMLElement>("[data-section-editor-templates]");
		const kindList = this.addDialog.querySelector<HTMLElement>("[data-section-editor-kinds]");
		if (tplList) {
			tplList.innerHTML = this.state.templates
				.map((t) => {
					const localized = this.labels.template[t.key];
					const title = localized?.title ?? t.defaultTitle;
					const desc = localized?.description ?? t.defaultDescription;
					return `<button type="button" class="ap-section-editor__pick" data-template="${escapeHtml(t.key)}">
  <strong>${escapeHtml(title)}</strong>
  <span>${escapeHtml(desc)}</span>
</button>`;
				})
				.join("");
		}
		if (kindList) {
			kindList.innerHTML = SECTION_KINDS.map(
				(
					kind,
				) => `<button type="button" class="ap-section-editor__pick" data-kind="${escapeHtml(kind)}">
  ${escapeHtml(this.labels.kind[kind])}
</button>`,
			).join("");
		}
	}

	private onAddDialogClick(e: Event) {
		const target = e.target as HTMLElement;
		if (target.closest("[data-section-editor-close]")) {
			this.addDialog?.close();
			return;
		}
		const tplBtn = target.closest<HTMLElement>("[data-template]");
		if (tplBtn) {
			const key = tplBtn.dataset.template ?? "";
			this.applyTemplate(key);
			this.addDialog?.close();
			return;
		}
		const kindBtn = target.closest<HTMLElement>("[data-kind]");
		if (kindBtn) {
			const kind = kindBtn.dataset.kind as SectionKind | undefined;
			if (kind && (SECTION_KINDS as readonly string[]).includes(kind)) {
				this.state.sections.push(defaultsForKind(kind));
				this.renderAll();
				this.syncHiddenInput();
			}
			this.addDialog?.close();
			return;
		}
	}

	private applyTemplate(key: string) {
		const tpl = this.state.templates.find((t) => t.key === key);
		if (!tpl) return;
		// We don't have buildTemplate here (server-only). Build from kinds with defaults.
		const id = () => uuid();
		const next = tpl.sectionKinds.map((kind) => {
			const def = defaultsForKind(kind);
			def.id = id();
			return def;
		});
		this.state.sections = [...this.state.sections, ...next];
		this.renderAll();
		this.syncHiddenInput();
	}
}

/**
 * Apply a dotted field path (`primaryCta.label`, `items[2].title`) to a
 * section in-place. Tolerant: silently no-ops on unknown paths so a
 * stray input event can't crash the editor.
 */
function applyField(target: AnySection, field: string, value: string): void {
	// Special-case array fields that are stored as comma-joined strings in the form
	if (target.kind === "testimonials" && field === "ids") {
		target.ids = value
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		return;
	}
	if (target.kind === "gallery" && field === "mediaIds") {
		target.mediaIds = value
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		return;
	}
	if ((target.kind === "feature-grid" || target.kind === "gallery") && field === "columns") {
		const n = Number.parseInt(value, 10);
		(target as { columns: number }).columns = n === 2 || n === 4 ? n : 3;
		return;
	}
	const arrayMatch = field.match(/^items\[(\d+)\]\.(\w+)$/);
	if (arrayMatch) {
		const idx = Number.parseInt(arrayMatch[1], 10);
		const key = arrayMatch[2];
		if (target.kind === "feature-grid" && Array.isArray(target.items)) {
			const item = target.items[idx];
			if (item && (key === "title" || key === "body" || key === "icon")) {
				(item as Record<string, string>)[key] = value;
			}
		} else if (target.kind === "faq" && Array.isArray(target.items)) {
			const item = target.items[idx];
			if (item && (key === "question" || key === "answer")) {
				(item as Record<string, string>)[key] = value;
			}
		}
		return;
	}
	const ctaMatch = field.match(/^(primaryCta|secondaryCta)\.(label|href)$/);
	if (ctaMatch) {
		const which = ctaMatch[1] as "primaryCta" | "secondaryCta";
		const key = ctaMatch[2] as "label" | "href";
		if (target.kind === "hero" || target.kind === "cta-banner") {
			const cta = (target as { [k: string]: CtaButton | undefined })[which] ?? {
				label: "",
				href: "",
			};
			cta[key] = value;
			(target as { [k: string]: CtaButton | undefined })[which] = cta;
		}
		return;
	}
	// Plain string fields
	(target as unknown as Record<string, unknown>)[field] = value;
}

if (typeof customElements !== "undefined" && !customElements.get("ap-section-editor")) {
	customElements.define("ap-section-editor", ApSectionEditor);
}
