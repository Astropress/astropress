// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../web-components/notice";

describe("ap-notice", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders with role=status and aria-live=polite", () => {
		const el = document.createElement("ap-notice") as HTMLElement;
		el.textContent = "Saved!";
		document.body.appendChild(el);
		expect(el.getAttribute("role")).toBe("status");
		expect(el.getAttribute("aria-live")).toBe("polite");
	});

	it("removes itself after dismiss-after milliseconds", () => {
		const el = document.createElement("ap-notice") as HTMLElement;
		el.setAttribute("dismiss-after", "3000");
		el.textContent = "Will go away";
		document.body.appendChild(el);
		expect(document.body.contains(el)).toBe(true);
		vi.advanceTimersByTime(3001);
		expect(document.body.contains(el)).toBe(false);
	});

	it("does not auto-dismiss when dismiss-after is not set", () => {
		const el = document.createElement("ap-notice") as HTMLElement;
		el.textContent = "Stays";
		document.body.appendChild(el);
		vi.advanceTimersByTime(60000);
		expect(document.body.contains(el)).toBe(true);
	});

	it("clears the timer on disconnection", () => {
		const el = document.createElement("ap-notice") as HTMLElement;
		el.setAttribute("dismiss-after", "3000");
		document.body.appendChild(el);
		el.remove();
		// Should not throw after removal
		expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
	});

	it("ignores non-numeric dismiss-after values", () => {
		const el = document.createElement("ap-notice") as HTMLElement;
		el.setAttribute("dismiss-after", "notanumber");
		document.body.appendChild(el);
		vi.advanceTimersByTime(10000);
		expect(document.body.contains(el)).toBe(true);
	});
});
