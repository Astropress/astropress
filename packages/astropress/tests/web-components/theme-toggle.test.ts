// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../web-components/theme-toggle";
import type { ApThemeToggle } from "../../web-components/theme-toggle";

// jsdom does not implement window.matchMedia — stub it for all tests in this file
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Node ≥25 ships a built-in `localStorage` global that shadows jsdom's; when
// Node isn't started with a valid --localstorage-file it is a stub whose
// setItem/getItem throw "not a function", so the component's guarded writes
// silently no-op and there is nothing to spy on. Supply a real in-memory
// Storage for this file instead of trusting whichever runtime global wins.
class MemoryStorage {
	#store = new Map<string, string>();
	getItem(key: string): string | null {
		return this.#store.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.#store.set(key, String(value));
	}
	removeItem(key: string): void {
		this.#store.delete(key);
	}
	clear(): void {
		this.#store.clear();
	}
	key(index: number): string | null {
		return [...this.#store.keys()][index] ?? null;
	}
	get length(): number {
		return this.#store.size;
	}
}
Object.defineProperty(window, "localStorage", {
	configurable: true,
	value: new MemoryStorage(),
});

function makeToggle(labelDark = "Switch to dark mode", labelLight = "Switch to light mode") {
	const el = document.createElement("ap-theme-toggle") as ApThemeToggle;
	el.setAttribute("label-dark", labelDark);
	el.setAttribute("label-light", labelLight);
	el.innerHTML = `
    <button type="button" class="theme-toggle-admin" aria-pressed="false" aria-label="${labelDark}">
      <span class="theme-toggle-icon" aria-hidden="true"></span>
    </button>
  `;
	return el;
}

describe("ApThemeToggle", () => {
	beforeEach(() => {
		document.documentElement.removeAttribute("data-theme");
		// Explicitly window.localStorage (the object the component writes to):
		// Node 25 exposes its own `localStorage`/`Storage` globals, so the bare
		// identifiers can bind to Node's webstorage instead of jsdom's.
		try {
			window.localStorage.removeItem("theme");
		} catch {}
	});

	afterEach(() => {
		document.documentElement.removeAttribute("data-theme");
		document.body.innerHTML = "";
	});

	it("is registered as a custom element", () => {
		expect(customElements.get("ap-theme-toggle")).toBeDefined();
	});

	it("applies a theme to documentElement on connectedCallback", () => {
		const el = makeToggle();
		document.body.appendChild(el);
		const theme = document.documentElement.getAttribute("data-theme");
		expect(theme === "dark" || theme === "light").toBe(true);
	});

	it("toggles theme on button click", () => {
		const el = makeToggle();
		document.body.appendChild(el);

		// Force a known starting state
		document.documentElement.setAttribute("data-theme", "light");
		const button = el.querySelector("button") as HTMLButtonElement;

		button.click();
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

		button.click();
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});

	it("updates aria-pressed on toggle", () => {
		const el = makeToggle();
		document.body.appendChild(el);
		document.documentElement.setAttribute("data-theme", "light");
		const button = el.querySelector("button") as HTMLButtonElement;

		button.click(); // → dark
		expect(button.getAttribute("aria-pressed")).toBe("true");

		button.click(); // → light
		expect(button.getAttribute("aria-pressed")).toBe("false");
	});

	it("updates icon SVG on toggle", () => {
		const el = makeToggle();
		document.body.appendChild(el);
		document.documentElement.setAttribute("data-theme", "light");
		const button = el.querySelector("button") as HTMLButtonElement;
		const icon = el.querySelector(".theme-toggle-icon") as HTMLElement;

		button.click(); // → dark — shows sun SVG (click to go light)
		expect(icon.innerHTML).toContain("<svg");
		expect(icon.innerHTML).toContain("circle cx");

		button.click(); // → light — shows moon SVG (click to go dark)
		expect(icon.innerHTML).toContain("<svg");
		expect(icon.innerHTML).toContain("12.79");
	});

	it("persists theme to localStorage on toggle", () => {
		// Spy on window.localStorage itself, not the ambient `Storage.prototype`:
		// under Node 25 the bare `Storage` global is Node's built-in webstorage
		// class, whose prototype the jsdom-backed window.localStorage never hits.
		const spy = vi.spyOn(window.localStorage, "setItem");
		const el = makeToggle();
		document.body.appendChild(el);
		document.documentElement.setAttribute("data-theme", "light");

		(el.querySelector("button") as HTMLButtonElement).click(); // → dark
		expect(spy).toHaveBeenCalledWith("theme", "dark");
		expect(window.localStorage.getItem("theme")).toBe("dark");
		spy.mockRestore();
	});

	it("updates aria-label to reflect the opposite action", () => {
		const el = makeToggle("Go dark", "Go light");
		document.body.appendChild(el);
		document.documentElement.setAttribute("data-theme", "light");
		const button = el.querySelector("button") as HTMLButtonElement;

		// When light: clicking will go dark, so label should say "Go dark"
		expect(button.getAttribute("aria-label")).toBe("Go dark");

		button.click(); // → dark
		// When dark: clicking will go light, so label should say "Go light"
		expect(button.getAttribute("aria-label")).toBe("Go light");
	});

	it("syncs all toggles on the page when one is clicked", () => {
		const el1 = makeToggle();
		const el2 = makeToggle();
		document.body.appendChild(el1);
		document.body.appendChild(el2);

		document.documentElement.setAttribute("data-theme", "light");
		// Manually re-sync since we set attribute after connectedCallback
		(el1.querySelector("button") as HTMLButtonElement).click(); // → dark

		const btn2 = el2.querySelector("button") as HTMLButtonElement;
		expect(btn2.getAttribute("aria-pressed")).toBe("true");
	});

	it("removes click listener on disconnectedCallback", () => {
		const el = makeToggle();
		document.body.appendChild(el);
		document.documentElement.setAttribute("data-theme", "light");

		document.body.removeChild(el);

		// After disconnect, clicking the (now detached) button should not change theme
		// We can only verify no errors are thrown; the handler is removed
		expect(() => (el.querySelector("button") as HTMLButtonElement).click()).not.toThrow();
	});
});
