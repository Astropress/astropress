/**
 * Scheme/host validation for operator-configured embed URLs (#109).
 *
 * The admin CMS (`cms.astro`) and host-provider (`host.astro`) panels render a
 * configured URL into an `<iframe src>` or `<a href>`. An unvalidated value
 * there is dangerous: a `javascript:`/`data:`/`vbscript:` href executes script
 * in the admin origin on click, and a `file:`/arbitrary-scheme iframe is at
 * best broken and at worst an exfiltration vector. This helper enforces the
 * project policy — require `https:`, allow `http:` only for loopback hosts
 * (local dev), reject every other scheme — and is shared by both pages so the
 * rule can't drift between them.
 */

/** Loopback hosts for which plain http is tolerated in local development. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
	"::1",
	"0.0.0.0",
]);

export interface EmbedUrlResult {
	/** The normalised, safe URL — present only when ok. */
	readonly ok: boolean;
	readonly url?: string;
	readonly reason?: string;
}

function isLoopbackHost(hostname: string): boolean {
	return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Validates an embed URL against the admin embed policy. Returns
 * `{ ok: true, url }` with the normalised href when the URL is `https:` (or
 * `http:` to a loopback host), and `{ ok: false, reason }` otherwise — covering
 * unparseable values and every dangerous scheme (`javascript:`, `data:`,
 * `file:`, `vbscript:`, `blob:`, …). No per-deploy allowlist; scheme + host is
 * the whole policy (#109).
 */
export function validateEmbedUrl(raw: string | null | undefined): EmbedUrlResult {
	const value = raw?.trim();
	if (!value) {
		return { ok: false, reason: "No embed URL is configured." };
	}
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return { ok: false, reason: "Embed URL is not a valid absolute URL." };
	}
	if (parsed.protocol === "https:") {
		return { ok: true, url: parsed.href };
	}
	if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) {
		return { ok: true, url: parsed.href };
	}
	if (parsed.protocol === "http:") {
		return { ok: false, reason: "Embed URL must use https (http is allowed only for localhost)." };
	}
	return { ok: false, reason: `Embed URL scheme "${parsed.protocol}" is not allowed.` };
}
