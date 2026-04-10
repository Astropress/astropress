import type { APIRoute } from "astro";
import { newsletterAdapter } from "../../src/newsletter-adapter.js";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_HEADERS = { "Content-Type": "application/json" };

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

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json() as Record<string, unknown>;
      email = typeof body.email === "string" ? body.email.trim() : undefined;
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body." }), { status: 400, headers: JSON_HEADERS });
    }
  } else {
    const formData = await request.formData().catch(() => null);
    email = formData ? (String(formData.get("email") ?? "")).trim() : undefined;
  }

  if (!email || !SIMPLE_EMAIL_PATTERN.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: "A valid email address is required." }), { status: 400, headers: JSON_HEADERS });
  }

  const result = await newsletterAdapter.subscribe(email, locals);

  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, error: result.error ?? "Subscription failed." }), { status: 422, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
};
