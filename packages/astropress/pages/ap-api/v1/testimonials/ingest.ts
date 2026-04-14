import type { APIRoute } from "astro";
import { getCmsConfig } from "../../../../src/config.js";
import { checkRuntimeRateLimit, submitRuntimeTestimonial } from "../../../../src/runtime-mutation-store.js";
import type { TestimonialSubmissionInput, TestimonialSource } from "../../../../src/persistence-types.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function verifyHmac(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

type AnyObject = Record<string, unknown>;

function mapFormbricksPayload(data: AnyObject): Partial<TestimonialSubmissionInput> {
  const result: Partial<TestimonialSubmissionInput> = {};
  const responseData = (data as AnyObject)?.data as AnyObject | undefined;
  const answers: unknown[] = Array.isArray(responseData?.answers) ? (responseData.answers as unknown[]) : [];
  for (const answer of answers) {
    const a = answer as AnyObject;
    const headline = String(a.headline ?? "").toLowerCase();
    const value = typeof a.value === "string" ? a.value : undefined;
    if (!value) continue;
    if (headline.includes("name")) result.name = value;
    else if (headline.includes("email")) result.email = value;
    else if (headline.includes("company")) result.company = value;
    else if (headline.includes("role") || headline.includes("title")) result.role = value;
    else if (headline.includes("before") || headline.includes("fear") || headline.includes("challenge") || headline.includes("problem")) result.beforeState = value;
    else if (headline.includes("transform") || headline.includes("happen") || headline.includes("experience")) result.transformation = value;
    else if (headline.includes("result") || headline.includes("outcome") || headline.includes("specific")) result.specificResult = value;
  }
  result.consentToPublish = result.consentToPublish ?? true;
  return result;
}

function mapTypebotPayload(data: AnyObject): Partial<TestimonialSubmissionInput> {
  const result: Partial<TestimonialSubmissionInput> = {};
  const results = Array.isArray(data?.results) ? (data.results as AnyObject[]) : [];
  const firstResult = results[0];
  const variables: unknown[] = Array.isArray(firstResult?.variables) ? (firstResult.variables as unknown[]) : [];
  for (const v of variables) {
    const variable = v as AnyObject;
    const name = String(variable.name ?? "").toLowerCase();
    const value = typeof variable.value === "string" ? variable.value : undefined;
    if (!value) continue;
    if (name === "name" || name === "respondent_name") result.name = value;
    else if (name === "email" || name === "respondent_email") result.email = value;
    else if (name === "company") result.company = value;
    else if (name === "role" || name === "job_title") result.role = value;
    else if (name === "before_state" || name === "before" || name === "challenge") result.beforeState = value;
    else if (name === "transformation" || name === "what_happened") result.transformation = value;
    else if (name === "specific_result" || name === "result" || name === "outcome") result.specificResult = value;
    else if (name === "consent") result.consentToPublish = value.toLowerCase() !== "no" && value.toLowerCase() !== "false";
  }
  result.consentToPublish = result.consentToPublish ?? true;
  return result;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const ip = getClientIp(request);
  const allowed = await checkRuntimeRateLimit(`testimonial:ingest:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, locals);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: "Rate limit exceeded." }), { status: 429, headers: JSON_HEADERS });
  }

  const rawBody = await request.text().catch(() => null);
  if (!rawBody) {
    return new Response(JSON.stringify({ ok: false, error: "Empty body." }), { status: 400, headers: JSON_HEADERS });
  }

  const webhookSecret = getCmsConfig().testimonials?.webhookSecret;
  if (webhookSecret) {
    const signature =
      request.headers.get("X-Formbricks-Signature") ??
      request.headers.get("X-Typebot-Signature") ??
      "";
    if (!signature) {
      return new Response(JSON.stringify({ ok: false, error: "Missing signature." }), { status: 401, headers: JSON_HEADERS });
    }
    const valid = await verifyHmac(rawBody, signature, webhookSecret);
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid signature." }), { status: 401, headers: JSON_HEADERS });
    }
  } else {
    console.warn("[astropress] testimonials/ingest: no webhookSecret configured — accepting unauthenticated POST");
  }

  let body: AnyObject;
  try {
    body = JSON.parse(rawBody) as AnyObject;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON." }), { status: 400, headers: JSON_HEADERS });
  }

  let source: TestimonialSource;
  let mapped: Partial<TestimonialSubmissionInput>;

  if (body.type === "responseFinished" && typeof (body as AnyObject)?.data === "object") {
    source = "formbricks";
    mapped = mapFormbricksPayload(body);
  } else if (Array.isArray(body.results)) {
    source = "typebot";
    mapped = mapTypebotPayload(body);
  } else {
    return new Response(JSON.stringify({ ok: false, error: "Unrecognised webhook shape." }), { status: 400, headers: JSON_HEADERS });
  }

  if (!mapped.name || !mapped.email) {
    return new Response(JSON.stringify({ ok: false, error: "Could not extract name or email from payload." }), { status: 422, headers: JSON_HEADERS });
  }

  const input: TestimonialSubmissionInput = {
    name: mapped.name,
    email: mapped.email,
    company: mapped.company,
    role: mapped.role,
    beforeState: mapped.beforeState,
    transformation: mapped.transformation,
    specificResult: mapped.specificResult,
    consentToPublish: mapped.consentToPublish ?? true,
    source,
    submittedAt: new Date().toISOString(),
  };

  await submitRuntimeTestimonial(input, locals);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
};
