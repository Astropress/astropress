import type { SiteEntry, SiteHealth } from "./types.js";

const HEALTH_TIMEOUT_MS = 5_000;
const PROXY_TIMEOUT_MS = 10_000;

function buildHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
	};
}

export async function checkSiteHealth(site: SiteEntry): Promise<SiteHealth> {
	const start = Date.now();
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

		const res = await fetch(`${site.baseUrl}/ap-api/v1/settings`, {
			headers: buildHeaders(site.token),
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));

		const latencyMs = Date.now() - start;

		if (res.ok) {
			return {
				id: site.id,
				name: site.name,
				baseUrl: site.baseUrl,
				status: "ok",
				latencyMs,
			};
		}
		return {
			id: site.id,
			name: site.name,
			baseUrl: site.baseUrl,
			status: "degraded",
			error: `HTTP ${res.status}`,
			latencyMs,
		};
	} catch (err) {
		return {
			id: site.id,
			name: site.name,
			baseUrl: site.baseUrl,
			status: "degraded",
			error: err instanceof Error ? err.message : "unknown error",
			latencyMs: Date.now() - start,
		};
	}
}

export async function postSiteRequest(
	site: SiteEntry,
	path: string,
	body: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
	const url = new URL(`${site.baseUrl}/ap-api/v1/${path}`);

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

		const res = await fetch(url.toString(), {
			method: "POST",
			headers: {
				...buildHeaders(site.token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));

		let resBody: unknown;
		try {
			resBody = await res.json();
		} catch {
			resBody = {};
		}

		return { ok: res.ok, status: res.status, body: resBody };
	} catch (err) {
		return {
			ok: false,
			status: 502,
			body: { error: err instanceof Error ? err.message : "gateway error" },
		};
	}
}

export async function proxySiteRequest(
	site: SiteEntry,
	path: string,
	searchParams?: URLSearchParams,
): Promise<{ ok: boolean; status: number; body: unknown }> {
	const url = new URL(`${site.baseUrl}/ap-api/v1/${path}`);
	if (searchParams) {
		for (const [key, value] of searchParams.entries()) {
			url.searchParams.set(key, value);
		}
	}

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

		const res = await fetch(url.toString(), {
			headers: buildHeaders(site.token),
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));

		let body: unknown;
		try {
			body = await res.json();
		} catch {
			body = {};
		}

		return { ok: res.ok, status: res.status, body };
	} catch (err) {
		return {
			ok: false,
			status: 502,
			body: { error: err instanceof Error ? err.message : "gateway error" },
		};
	}
}
