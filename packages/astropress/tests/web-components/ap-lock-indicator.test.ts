// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../web-components/ap-lock-indicator";

const originalFetch = globalThis.fetch;

const BASE = "http://test.local";

function setAttrs(el: HTMLElement) {
	el.setAttribute("slug", "post-1");
	el.setAttribute("acquire-url", `${BASE}/lock/acquire`);
	el.setAttribute("refresh-url", `${BASE}/lock/refresh`);
	el.setAttribute("release-url", `${BASE}/lock/release`);
	el.setAttribute("csrf-token", "csrf-1");
}

function mockFetch(handler: (url: string) => Promise<Response> | Response) {
	const fn = vi.fn(async (url: string) => handler(url));
	globalThis.fetch = fn as unknown as typeof fetch;
	return fn;
}

describe("ap-lock-indicator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		// Clear body BEFORE restoring fetch so disconnectedCallback uses
		// the still-installed mock (real fetch would try to resolve test.local).
		document.body.innerHTML = "";
		vi.useRealTimers();
		globalThis.fetch = originalFetch;
	});

	it("returns early when required attributes are missing", async () => {
		const fetchMock = mockFetch(async () => new Response("{}"));
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		// Only slug — missing acquire-url and csrf-token.
		el.setAttribute("slug", "p1");
		document.body.appendChild(el);
		await Promise.resolve();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("acquires lock on connect and starts heartbeat", async () => {
		const fetchMock = mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						ok: true,
						lockToken: "tok-1",
						expiresAt: "2030-01-01T00:00:00Z",
					}),
					{ status: 200 },
				),
		);
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		setAttrs(el);
		document.body.appendChild(el);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			`${BASE}/lock/acquire`,
			expect.objectContaining({ method: "POST" }),
		);
		// Heartbeat fires after 4 minutes.
		await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			`${BASE}/lock/refresh`,
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("renders conflict banner when another user holds the lock", async () => {
		mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						ok: false,
						conflict: true,
						lockedByName: "Alice",
						expiresAt: "2030-01-01T00:00:00Z",
					}),
					{ status: 200 },
				),
		);
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		setAttrs(el);
		document.body.appendChild(el);
		await vi.waitFor(() => {
			const banner = el.querySelector("[data-ap-lock-conflict]");
			expect(banner).not.toBeNull();
		});
		const banner = el.querySelector("[data-ap-lock-conflict]") as HTMLElement;
		expect(banner.getAttribute("role")).toBe("alert");
		expect(banner.getAttribute("aria-live")).toBe("assertive");
		expect(banner.textContent).toContain("Alice");
	});

	it("does nothing on acquire-url returning non-OK", async () => {
		const fetchMock = mockFetch(async () => new Response("{}", { status: 500 }));
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		setAttrs(el);
		document.body.appendChild(el);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		// No heartbeat — token never set.
		vi.advanceTimersByTime(5 * 60 * 1000);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("releases lock on disconnect when token was acquired", async () => {
		const fetchMock = mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						ok: true,
						lockToken: "tok-1",
						expiresAt: "2030-01-01T00:00:00Z",
					}),
					{ status: 200 },
				),
		);
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		setAttrs(el);
		document.body.appendChild(el);
		// Wait for acquire fetch *and* the .json() microtask that sets _lockToken.
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await vi.advanceTimersByTimeAsync(0);
		el.remove();
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock.mock.calls.some((c) => c[0] === `${BASE}/lock/release`)).toBe(true);
	});

	it("skips release when no token was acquired (e.g. conflict path)", async () => {
		const fetchMock = mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						ok: false,
						conflict: true,
						lockedByName: "Alice",
						expiresAt: "2030-01-01T00:00:00Z",
					}),
					{ status: 200 },
				),
		);
		const el = document.createElement("ap-lock-indicator") as HTMLElement;
		setAttrs(el);
		document.body.appendChild(el);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		el.remove();
		// Brief tick to flush microtasks.
		await Promise.resolve();
		expect(fetchMock.mock.calls.some((c) => c[0] === `${BASE}/lock/release`)).toBe(false);
	});
});
