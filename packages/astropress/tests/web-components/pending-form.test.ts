// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../web-components/pending-form";

/**
 * Unit-tests the <ap-pending-form> web-component behavior in a jsdom-like
 * environment. Uses the shared HTMLElement polyfill set up for other
 * web-component tests in this directory.
 *
 * These tests double as the mutation-testing harness for pending-form.ts.
 * Every assertion below kills a specific class of mutation:
 *   - attribute writes (data-pending, aria-busy)
 *   - disabled assignment
 *   - event listener wiring
 *   - cleanup in disconnectedCallback
 *   - defaultPrevented guard
 *   - button selector scope (submit + default-type only)
 */

function mount(html: string): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.innerHTML = html;
	document.body.appendChild(wrapper);
	return wrapper.firstElementChild as HTMLElement;
}

function cleanup() {
	document.body.innerHTML = "";
}

describe("ap-pending-form: submit wiring", () => {
	beforeEach(() => cleanup());
	afterEach(() => cleanup());

	it("sets data-pending=true on itself when the inner form submits", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button type="submit">Save</button></form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		expect(host.getAttribute("data-pending")).toBe("true");
	});

	it("sets aria-busy=true on every submit button inside the form", () => {
		const host = mount(`
			<ap-pending-form>
				<form>
					<button type="submit">Save</button>
					<button type="submit" class="alt">Save alt</button>
				</form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		const buttons = host.querySelectorAll("button");
		for (const b of buttons) expect(b.getAttribute("aria-busy")).toBe("true");
	});

	it("also covers buttons with no explicit type attribute (browser default is 'submit')", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button>Implicit submit</button></form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		const button = host.querySelector("button") as HTMLButtonElement;
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.disabled).toBe(true);
	});

	it("disables submit buttons after submit (prevents double-post)", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button type="submit">Save</button></form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		const button = host.querySelector("button") as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		expect(button.disabled).toBe(true);
	});

	it("does not flip state when the submit event was already prevented", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button type="submit">Save</button></form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		const event = new Event("submit", { cancelable: true });
		event.preventDefault();
		form.dispatchEvent(event);
		expect(host.hasAttribute("data-pending")).toBe(false);
		const button = host.querySelector("button") as HTMLButtonElement;
		expect(button.disabled).toBe(false);
	});

	it("is a no-op when no <form> child exists", () => {
		const host = mount(`
			<ap-pending-form>
				<button type="submit">No form here</button>
			</ap-pending-form>
		`);
		// Should not throw and should not flag anything
		expect(host.hasAttribute("data-pending")).toBe(false);
		const button = host.querySelector("button") as HTMLButtonElement;
		expect(button.disabled).toBe(false);
	});

	it("ignores non-submit button types (reset / button do not get disabled)", () => {
		const host = mount(`
			<ap-pending-form>
				<form>
					<button type="reset">Reset</button>
					<button type="button">Side action</button>
					<button type="submit">Save</button>
				</form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		const reset = host.querySelector(
			'button[type="reset"]',
		) as HTMLButtonElement;
		const btn = host.querySelector(
			'button[type="button"]',
		) as HTMLButtonElement;
		const submit = host.querySelector(
			'button[type="submit"]',
		) as HTMLButtonElement;
		expect(reset.disabled).toBe(false);
		expect(btn.disabled).toBe(false);
		expect(submit.disabled).toBe(true);
	});
});

describe("ap-pending-form: lifecycle", () => {
	beforeEach(() => cleanup());
	afterEach(() => cleanup());

	it("removes its submit listener on disconnection", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button type="submit">Save</button></form>
			</ap-pending-form>
		`);
		const form = host.querySelector("form") as HTMLFormElement;
		host.remove();
		// After disconnect, dispatching submit should not flip pending state
		// (the element is detached; flipping its attributes would be a leak).
		form.dispatchEvent(new Event("submit", { cancelable: true }));
		expect(host.hasAttribute("data-pending")).toBe(false);
	});

	it("does nothing on a second connect if the DOM lost the inner form", () => {
		const host = mount(`
			<ap-pending-form>
				<form><button type="submit">Save</button></form>
			</ap-pending-form>
		`);
		host.remove();
		// Clear inner form; re-attach
		host.innerHTML = "";
		document.body.appendChild(host);
		// Nothing to listen to — should not throw
		expect(host.hasAttribute("data-pending")).toBe(false);
	});
});
