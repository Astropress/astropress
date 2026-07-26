import type { APIRoute } from "astro";
import {
	EMAIL_RATE_LIMIT_MAX,
	EMAIL_RATE_LIMIT_WINDOW_MS,
	IP_RATE_LIMIT_MAX,
	IP_RATE_LIMIT_WINDOW_MS,
	JSON_HEADERS,
	MESSAGE_MAX_LENGTH,
	NAME_MAX_LENGTH,
	SIMPLE_EMAIL_PATTERN,
} from "./contact-endpoint-data.js";
import { recordD1Audit } from "./d1-audit.js";
import { checkRuntimeRateLimit, submitRuntimeContact } from "./runtime-mutation-store.js";
import { verifyTurnstileToken } from "./turnstile.js";

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
		"unknown"
	);
}

interface ContactFields {
	name?: string;
	email?: string;
	message?: string;
	website?: string;
	turnstileToken?: string;
}

// The wire shape: every field arrives untrusted and is narrowed one-by-one in
// fieldsFromRecord. Form-encoded bodies (Record<string, FormDataEntryValue>)
// are assignable to it too.
interface ContactRequestBody {
	name?: unknown;
	email?: unknown;
	message?: unknown;
	website?: unknown;
	turnstileToken?: unknown;
	"cf-turnstile-response"?: unknown;
}

function fieldsFromRecord(body: ContactRequestBody): ContactFields {
	const str = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() : undefined);
	const rawToken = body["cf-turnstile-response"] ?? body.turnstileToken;
	return {
		name: str(body.name),
		email: str(body.email),
		message: str(body.message),
		website: str(body.website),
		turnstileToken: typeof rawToken === "string" ? rawToken : undefined,
	};
}

function badRequest(error: string): Response {
	return new Response(JSON.stringify({ ok: false, error }), {
		status: 400,
		headers: JSON_HEADERS,
	});
}

/**
 * POST /ap/contact
 *
 * Public contact-form intake (#193). Accepts a JSON or form-encoded body with
 * `name`, `email`, and `message` fields and stores the submission in the
 * runtime contact-submissions store, where it appears under /ap-admin/forms.
 *
 * `website` is a honeypot: real visitors never see or fill it, so a non-empty
 * value marks a bot and the request is acknowledged without being stored.
 *
 * Response:
 *   200 { ok: true }                    — submission stored (or honeypot-dropped)
 *   400 { ok: false, error: "..." }     — missing/invalid fields
 *   403 { ok: false, error: "..." }     — Turnstile challenge failed
 *   429 { ok: false, error: "..." }     — rate limited
 */
export const POST: APIRoute = async ({ request, locals }) => {
	let fields: ContactFields;

	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		try {
			fields = fieldsFromRecord((await request.json()) as ContactRequestBody);
		} catch {
			return badRequest("Invalid JSON body.");
		}
	} else {
		const formData = await request.formData().catch(() => null);
		if (formData === null) {
			return badRequest("Invalid form body.");
		}
		fields = fieldsFromRecord(Object.fromEntries(formData.entries()));
	}

	const { name, email, message, website, turnstileToken } = fields;

	if (!name || name.length > NAME_MAX_LENGTH) {
		return badRequest("A name is required (200 characters max).");
	}
	if (!email || !SIMPLE_EMAIL_PATTERN.test(email)) {
		return badRequest("A valid email address is required.");
	}
	if (!message || message.length > MESSAGE_MAX_LENGTH) {
		return badRequest("A message is required (5000 characters max).");
	}

	// Honeypot tripped: acknowledge without storing so the bot learns nothing.
	if (website) {
		return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
	}

	// Per-IP + per-email rate limit before any store write. Both windows must
	// pass; either tripping returns 429.
	const ip = getClientIp(request);
	const ipAllowed = await checkRuntimeRateLimit(
		`contact:ip:${ip}`,
		IP_RATE_LIMIT_MAX,
		IP_RATE_LIMIT_WINDOW_MS,
		locals,
	);
	const emailAllowed = await checkRuntimeRateLimit(
		`contact:email:${email.toLowerCase()}`,
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

	// Require a Turnstile challenge when one is configured. When Turnstile is
	// unconfigured, verifyTurnstileToken resolves ok — the endpoint stays usable
	// in dev/self-host setups that don't run a challenge.
	const challenge = await verifyTurnstileToken({ token: turnstileToken, ipAddress: ip, locals });
	if (!challenge.ok) {
		return new Response(
			JSON.stringify({ ok: false, error: challenge.error ?? "Security challenge failed." }),
			{ status: 403, headers: JSON_HEADERS },
		);
	}

	const result = await submitRuntimeContact(
		{ name, email, message, submittedAt: new Date().toISOString() },
		locals,
	);

	await recordD1Audit(
		locals,
		{ email: "public", role: "editor" as const, name: "Public visitor" },
		"contact.submit",
		"forms",
		result.submission.id,
		`Contact submission from ${email}`,
	).catch(() => {
		// Non-fatal: audit failure must not break the submission response
	});

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: JSON_HEADERS,
	});
};
