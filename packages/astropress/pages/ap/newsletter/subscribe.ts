import type { APIRoute } from "astro";
import { recordD1Audit } from "../../../src/d1-audit.js";
import { newsletterAdapter } from "../../../src/newsletter-adapter.js";
import { checkRuntimeRateLimit } from "../../../src/runtime-mutation-store.js";
import { verifyTurnstileToken } from "../../../src/turnstile.js";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_HEADERS = { "Content-Type": "application/json" };

// Abuse limits for this unauthenticated public endpoint (#136). Per-IP caps a
// single client; per-email stops a botnet from hammering one address across IPs.
const IP_RATE_LIMIT_MAX = 10;
const IP_RATE_LIMIT_WINDOW_MS = 60_000;
const EMAIL_RATE_LIMIT_MAX = 3;
const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60_000;

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

/**
 * POST /ap/newsletter/subscribe
 *
 * Public newsletter subscription endpoint. Accepts a JSON or form-encoded body
 * with an `email` field and forwards to the configured newsletter adapter.
 *
 * Response:
 *   200 { ok: true }                    — subscription succeeded
 *   400 { ok: false, error: "..." }     — invalid email
 *   422 { ok: false, error: "..." }     — adapter configuration error or delivery failure
 *
 * The delivery mode is controlled by the NEWSLETTER_DELIVERY_MODE env var:
 *   - "listmonk" — self-hosted Listmonk instance (requires LISTMONK_* vars)
 *   - "mailchimp" — Mailchimp API (requires MAILCHIMP_* vars)
 *   - "mock"      — always succeeds; used in development
 */
export const POST: APIRoute = async ({ request, locals }) => {
	let email: string | undefined;
	let turnstileToken: string | undefined;

	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		try {
			const body = (await request.json()) as Record<string, unknown>;
			email = typeof body.email === "string" ? body.email.trim() : undefined;
			const rawToken = body["cf-turnstile-response"] ?? body.turnstileToken;
			turnstileToken = typeof rawToken === "string" ? rawToken : undefined;
		} catch {
			return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body." }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}
	} else {
		const formData = await request.formData().catch(() => null);
		email = formData ? String(formData.get("email") ?? "").trim() : undefined;
		turnstileToken = formData ? String(formData.get("cf-turnstile-response") ?? "") : undefined;
	}

	if (!email || !SIMPLE_EMAIL_PATTERN.test(email)) {
		return new Response(
			JSON.stringify({
				ok: false,
				error: "A valid email address is required.",
			}),
			{ status: 400, headers: JSON_HEADERS },
		);
	}

	// Per-IP + per-email rate limit before any adapter call (#136). Both windows
	// must pass; either tripping returns 429 so a single client or a single
	// targeted address can't be used to flood the adapter.
	const ip = getClientIp(request);
	const ipAllowed = await checkRuntimeRateLimit(
		`newsletter:ip:${ip}`,
		IP_RATE_LIMIT_MAX,
		IP_RATE_LIMIT_WINDOW_MS,
		locals,
	);
	const emailAllowed = await checkRuntimeRateLimit(
		`newsletter:email:${email.toLowerCase()}`,
		EMAIL_RATE_LIMIT_MAX,
		EMAIL_RATE_LIMIT_WINDOW_MS,
		locals,
	);
	if (!ipAllowed || !emailAllowed) {
		return new Response(
			JSON.stringify({ ok: false, error: "Too many requests. Please try again later." }),
			{ status: 429, headers: JSON_HEADERS },
		);
	}

	// Require a Turnstile challenge when one is configured (#136). When Turnstile
	// is unconfigured, verifyTurnstileToken resolves ok — the endpoint stays
	// usable in dev/self-host setups that don't run a challenge.
	const challenge = await verifyTurnstileToken({ token: turnstileToken, ipAddress: ip, locals });
	if (!challenge.ok) {
		return new Response(
			JSON.stringify({ ok: false, error: challenge.error ?? "Security challenge failed." }),
			{ status: 403, headers: JSON_HEADERS },
		);
	}

	const result = await newsletterAdapter.subscribe(email, locals);

	if (!result.ok) {
		return new Response(
			JSON.stringify({
				ok: false,
				error: result.error ?? "Subscription failed.",
			}),
			{ status: 422, headers: JSON_HEADERS },
		);
	}

	// Record a conversion audit event for first-party analytics (GDPR Art. 6(1)(f))
	const utmSource = new URL(request.url).searchParams.get("utm_source") ?? undefined;
	await recordD1Audit(
		locals,
		{ email: "public", role: "editor" as const, name: "Public visitor" },
		"newsletter.subscribe",
		"newsletter",
		email,
		`Newsletter subscription from ${utmSource ?? "direct"}`,
	).catch(() => {
		// Non-fatal: audit failure must not break the subscription response
	});

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: JSON_HEADERS,
	});
};
