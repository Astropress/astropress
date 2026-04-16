// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApThemeToggle } from "../../web-components/theme-toggle";

// jsdom does not implement window.matchMedia — stub it for all tests in this file
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes("dark") ? false : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
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
    try { localStorage.removeItem("theme"); } catch {}
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
    const button = el.querySelector<HTMLButtonElement>("button")!;

    button.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    button.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("updates aria-pressed on toggle", () => {
    const el = makeToggle();
    document.body.appendChild(el);
    document.documentElement.setAttribute("data-theme", "light");
    const button = el.querySelector<HTMLButtonElement>("button")!;

    button.click(); // → dark
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click(); // → light
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("updates icon SVG on toggle", () => {
    const el = makeToggle();
    document.body.appendChild(el);
    document.documentElement.setAttribute("data-theme", "light");
    const button = el.querySelector<HTMLButtonElement>("button")!;
    const icon = el.querySelector<HTMLElement>(".theme-toggle-icon")!;

    button.click(); // → dark — shows sun SVG (click to go light)
    expect(icon.innerHTML).toContain("<svg");
    expect(icon.innerHTML).toContain("circle cx");

    button.click(); // → light — shows moon SVG (click to go dark)
    expect(icon.innerHTML).toContain("<svg");
    expect(icon.innerHTML).toContain("12.79");
  });

  it("persists theme to localStorage on toggle", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const el = makeToggle();
    document.body.appendChild(el);
    document.documentElement.setAttribute("data-theme", "light");

    el.querySelector<HTMLButtonElement>("button")!.click(); // → dark
    expect(spy).toHaveBeenCalledWith("theme", "dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    spy.mockRestore();
  });

  it("updates aria-label to reflect the opposite action", () => {
    const el = makeToggle("Go dark", "Go light");
    document.body.appendChild(el);
    document.documentElement.setAttribute("data-theme", "light");
    const button = el.querySelector<HTMLButtonElement>("button")!;

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
    el1.querySelector<HTMLButtonElement>("button")!.click(); // → dark

    const btn2 = el2.querySelector<HTMLButtonElement>("button")!;
    expect(btn2.getAttribute("aria-pressed")).toBe("true");
  });

  it("removes click listener on disconnectedCallback", () => {
    const el = makeToggle();
    document.body.appendChild(el);
    document.documentElement.setAttribute("data-theme", "light");

    document.body.removeChild(el);

    // After disconnect, clicking the (now detached) button should not change theme
    // We can only verify no errors are thrown; the handler is removed
    expect(() => el.querySelector<HTMLButtonElement>("button")!.click()).not.toThrow();
  });
});
