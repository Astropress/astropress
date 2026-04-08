// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import "../../web-components/admin-nav";

describe("ap-admin-nav", () => {
  function buildNav(): { root: HTMLElement; toggle: HTMLButtonElement; close: HTMLButtonElement; sidebar: HTMLElement } {
    const root = document.createElement("ap-admin-nav") as HTMLElement;
    root.innerHTML = `
      <button
        type="button"
        data-nav-toggle
        aria-label="Open navigation"
        aria-expanded="false"
        data-label-open="Open navigation"
        data-label-close="Close navigation"
      >☰</button>
      <div>
        <nav
          data-nav-sidebar
          id="admin-sidebar"
        >
          <button type="button" data-nav-close aria-label="Close navigation">✕</button>
          <a href="/ap-admin">Dashboard</a>
        </nav>
      </div>
    `;
    document.body.appendChild(root);
    return {
      root,
      toggle: root.querySelector("[data-nav-toggle]") as HTMLButtonElement,
      close: root.querySelector("[data-nav-close]") as HTMLButtonElement,
      sidebar: root.querySelector("[data-nav-sidebar]") as HTMLElement,
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("sidebar does not have data-open initially", () => {
    const { sidebar } = buildNav();
    expect(sidebar.hasAttribute("data-open")).toBe(false);
  });

  it("clicking toggle button opens the sidebar", () => {
    const { toggle, sidebar } = buildNav();
    toggle.click();
    expect(sidebar.hasAttribute("data-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Close navigation");
  });

  it("clicking close button closes the sidebar", () => {
    const { toggle, close, sidebar } = buildNav();
    toggle.click();
    expect(sidebar.hasAttribute("data-open")).toBe(true);
    close.click();
    expect(sidebar.hasAttribute("data-open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Open navigation");
  });

  it("Escape key closes the sidebar when open", () => {
    const { toggle, sidebar } = buildNav();
    toggle.click();
    expect(sidebar.hasAttribute("data-open")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(sidebar.hasAttribute("data-open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape key does nothing when sidebar is already closed", () => {
    const { sidebar } = buildNav();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(sidebar.hasAttribute("data-open")).toBe(false);
  });

  it("disconnecting removes event listeners (no error on Escape after remove)", () => {
    const { root, toggle } = buildNav();
    toggle.click();
    root.remove();
    expect(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }).not.toThrow();
  });
});
