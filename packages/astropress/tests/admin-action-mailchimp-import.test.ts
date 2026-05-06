import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMailchimpImport } from "../src/admin-action-mailchimp-import";

const ENV_KEYS = [
	"NEWSLETTER_DELIVERY_MODE",
	"LISTMONK_API_URL",
	"LISTMONK_API_USERNAME",
	"LISTMONK_API_PASSWORD",
	"LISTMONK_LIST_ID",
] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
	for (const k of ENV_KEYS) {
		if (values[k] === undefined) delete process.env[k];
		else process.env[k] = values[k];
	}
}

const FULL_LISTMONK_ENV: Partial<Record<(typeof ENV_KEYS)[number], string>> = {
	NEWSLETTER_DELIVERY_MODE: "listmonk",
	LISTMONK_API_URL: "https://listmonk.example/api",
	LISTMONK_API_USERNAME: "u",
	LISTMONK_API_PASSWORD: "p",
	LISTMONK_LIST_ID: "7",
};

const okFetch = vi.fn(async () => new Response("ok", { status: 200 }) as never);

beforeEach(() => {
	setEnv(FULL_LISTMONK_ENV);
	(globalThis as { fetch?: unknown }).fetch = okFetch;
	okFetch.mockClear();
});
afterEach(() => {
	setEnv({});
	vi.restoreAllMocks();
});

describe("runMailchimpImport — config validation", () => {
	it("returns ok:false with config error when mode is not listmonk", async () => {
		setEnv({ ...FULL_LISTMONK_ENV, NEWSLETTER_DELIVERY_MODE: "mock" });
		const r = await runMailchimpImport("Email Address\nx@y.com\n", null);
		expect(r.ok).toBe(false);
		expect(r.imported).toBe(0);
		expect(r.error).toContain("Listmonk is not configured");
	});

	it("returns ok:false when listmonkApiUrl is missing", async () => {
		setEnv({ ...FULL_LISTMONK_ENV, LISTMONK_API_URL: undefined });
		const r = await runMailchimpImport("Email Address\nx@y.com\n", null);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Listmonk is not configured");
	});

	it("returns ok:false when listmonkApiUsername is missing", async () => {
		setEnv({ ...FULL_LISTMONK_ENV, LISTMONK_API_USERNAME: undefined });
		const r = await runMailchimpImport("Email Address\nx@y.com\n", null);
		expect(r.ok).toBe(false);
	});

	it("returns ok:false when listmonkApiPassword is missing", async () => {
		setEnv({ ...FULL_LISTMONK_ENV, LISTMONK_API_PASSWORD: undefined });
		const r = await runMailchimpImport("Email Address\nx@y.com\n", null);
		expect(r.ok).toBe(false);
	});

	it("returns ok:false when listmonkListId is missing", async () => {
		setEnv({ ...FULL_LISTMONK_ENV, LISTMONK_API_LIST_ID: undefined });
		setEnv({ ...FULL_LISTMONK_ENV, LISTMONK_LIST_ID: undefined });
		const r = await runMailchimpImport("Email Address\nx@y.com\n", null);
		expect(r.ok).toBe(false);
	});
});

describe("runMailchimpImport — CSV parsing", () => {
	it("returns ok:false when CSV has fewer than 2 lines", async () => {
		const r = await runMailchimpImport("Email Address", null);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("No valid subscriber rows");
		expect(okFetch).not.toHaveBeenCalled();
	});

	it("returns ok:false when CSV has no Email Address column", async () => {
		const r = await runMailchimpImport("Name,City\nA,B\n", null);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("No valid subscriber rows");
	});

	it("skips rows without an @ in the email", async () => {
		const r = await runMailchimpImport(
			"Email Address\nnot-an-email\nfoo@bar.com\n",
			null,
		);
		expect(r.ok).toBe(true);
		expect(r.imported).toBe(1);
	});

	it("skips empty email rows", async () => {
		const r = await runMailchimpImport("Email Address\n\nfoo@bar.com\n", null);
		expect(r.ok).toBe(true);
		expect(r.imported).toBe(1);
	});

	it("strips quotes around header and field values", async () => {
		const r = await runMailchimpImport(
			'"Email Address","First Name","Last Name"\n"a@b.com","Ada","Lovelace"\n',
			null,
		);
		expect(r.ok).toBe(true);
		expect(r.imported).toBe(1);
		const body = JSON.parse(String(okFetch.mock.calls[0]?.[1]?.body ?? "{}"));
		expect(String(body.records)).toContain("a@b.com,Ada Lovelace");
	});

	it("falls back to email when First/Last columns are missing entirely", async () => {
		const r = await runMailchimpImport("Email Address\na@b.com\n", null);
		expect(r.ok).toBe(true);
		const body = JSON.parse(String(okFetch.mock.calls[0]?.[1]?.body ?? "{}"));
		expect(String(body.records)).toContain("a@b.com,a@b.com");
	});

	it("falls back to email when First/Last cells are empty", async () => {
		const r = await runMailchimpImport(
			"Email Address,First Name,Last Name\na@b.com,,\n",
			null,
		);
		expect(r.ok).toBe(true);
		const body = JSON.parse(String(okFetch.mock.calls[0]?.[1]?.body ?? "{}"));
		expect(String(body.records)).toContain("a@b.com,a@b.com");
	});

	it("joins First+Last with a space when both present", async () => {
		const r = await runMailchimpImport(
			"Email Address,First Name,Last Name\na@b.com,Ada,Lovelace\n",
			null,
		);
		expect(r.ok).toBe(true);
		const body = JSON.parse(String(okFetch.mock.calls[0]?.[1]?.body ?? "{}"));
		expect(String(body.records)).toContain("Ada Lovelace");
	});

	it("matches header columns case-insensitively", async () => {
		const r = await runMailchimpImport(
			"EMAIL ADDRESS,first name,LAST name\na@b.com,Ada,Lovelace\n",
			null,
		);
		expect(r.ok).toBe(true);
		expect(r.imported).toBe(1);
	});
});

describe("runMailchimpImport — Listmonk dispatch", () => {
	it("POSTs to /api/subscribers/import with Basic auth and JSON body", async () => {
		await runMailchimpImport("Email Address\na@b.com\n", null);
		expect(okFetch).toHaveBeenCalledTimes(1);
		const [url, init] = okFetch.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			"https://listmonk.example/api/api/subscribers/import",
		);
		const initRec = init as {
			method?: string;
			headers?: Record<string, string>;
			body?: string;
		};
		expect(initRec.method).toBe("POST");
		expect(initRec.headers?.["Content-Type"]).toBe("application/json");
		expect(initRec.headers?.Authorization).toBe(`Basic ${btoa("u:p")}`);
		const body = JSON.parse(String(initRec.body));
		expect(body.mode).toBe("subscribe");
		expect(body.subscription_status).toBe("confirmed");
		expect(body.delims).toBe(",");
		expect(body.lists).toEqual([7]);
		expect(String(body.records)).toContain("email,name");
		expect(String(body.records)).toContain("a@b.com,a@b.com");
	});

	it("returns ok:true with imported count when Listmonk responds 200", async () => {
		const r = await runMailchimpImport(
			"Email Address\na@b.com\nc@d.com\n",
			null,
		);
		expect(r).toEqual({ ok: true, imported: 2, skipped: 0 });
	});

	it("returns ok:false with status-bearing error when Listmonk responds non-2xx", async () => {
		(globalThis as { fetch?: unknown }).fetch = vi.fn(
			async () => new Response("nope", { status: 401 }) as never,
		);
		const r = await runMailchimpImport("Email Address\na@b.com\n", null);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("401");
		expect(r.error).toContain("credentials");
	});

	it("returns ok:false with network-error message when fetch throws", async () => {
		(globalThis as { fetch?: unknown }).fetch = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		});
		const r = await runMailchimpImport("Email Address\na@b.com\n", null);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Network error");
	});
});
