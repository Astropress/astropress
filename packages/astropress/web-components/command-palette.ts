/**
 * <ap-command-palette> — keyboard-driven ⌘K command palette for the admin shell.
 *
 * Usage: rendered by AdminLayout.astro with a `data-nav-items` JSON attribute.
 * Opens via Ctrl+K / Meta+K. Filters nav items by label. Arrow keys + Enter to navigate.
 */

interface NavItem {
	label: string;
	href: string;
}

export class ApCommandPalette extends HTMLElement {
	private dialog!: HTMLDialogElement;
	private input!: HTMLInputElement;
	private results!: HTMLUListElement;
	private items: NavItem[] = [];
	private selectedIndex = -1;

	connectedCallback() {
		this.dialog = this.querySelector("#cmd-palette") as HTMLDialogElement;
		this.input = this.querySelector(".cmd-input") as HTMLInputElement;
		this.results = this.querySelector(".cmd-results") as HTMLUListElement;

		try {
			this.items = JSON.parse(this.dataset.navItems ?? "[]") as NavItem[];
		} catch {
			this.items = [];
		}

		document.addEventListener("keydown", this.onDocumentKeydown);
		this.input.addEventListener("input", this.onInput);
		this.input.addEventListener("keydown", this.onInputKeydown);
		this.dialog.addEventListener("close", this.onClose);
	}

	disconnectedCallback() {
		document.removeEventListener("keydown", this.onDocumentKeydown);
	}

	private onDocumentKeydown = (e: KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "k") {
			e.preventDefault();
			this.open();
		}
	};

	private open() {
		this.input.value = "";
		this.selectedIndex = -1;
		this.renderResults(this.items);
		this.dialog.showModal();
		this.input.focus();
	}

	private onClose = () => {
		this.results.innerHTML = "";
		this.selectedIndex = -1;
	};

	private onInput = () => {
		const q = this.input.value.trim().toLowerCase();
		const filtered = q
			? this.items.filter((item) => item.label.toLowerCase().includes(q))
			: this.items;
		this.selectedIndex = -1;
		this.renderResults(filtered);
	};

	private renderResults(items: NavItem[]) {
		if (items.length === 0) {
			this.results.innerHTML = `<li class="cmd-empty" role="option" aria-selected="false">No results</li>`;
			return;
		}
		this.results.innerHTML = items
			.map(
				(item, i) =>
					`<li role="option" aria-selected="${i === this.selectedIndex ? "true" : "false"}">` +
					`<a href="${item.href}">${item.label}</a></li>`,
			)
			.join("");
	}

	private onInputKeydown = (e: KeyboardEvent) => {
		const lis = Array.from(
			this.results.querySelectorAll<HTMLLIElement>("li[role='option']"),
		);
		if (!lis.length) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.selectedIndex = Math.min(this.selectedIndex + 1, lis.length - 1);
			this.updateSelection(lis);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
			this.updateSelection(lis);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const active = lis[this.selectedIndex];
			const link = active?.querySelector<HTMLAnchorElement>("a");
			if (link) {
				this.dialog.close();
				link.click();
			}
		}
	};

	private updateSelection(lis: HTMLLIElement[]) {
		lis.forEach((li, i) =>
			li.setAttribute(
				"aria-selected",
				i === this.selectedIndex ? "true" : "false",
			),
		);
		lis[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
	}
}

customElements.define("ap-command-palette", ApCommandPalette);
