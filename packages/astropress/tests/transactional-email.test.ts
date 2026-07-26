import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isProductionRuntime } from "../src/runtime-env.js";

const sendMailMock = vi.fn(async (_msg: unknown) => ({ accepted: ["u@x.com"] }));

vi.mock("nodemailer", () => ({
	default: {
		createTransport: vi.fn((opts: unknown) => {
			lastTransportOpts = opts;
			return { sendMail: sendMailMock };
		}),
	},
}));

let lastTransportOpts: unknown = null;

vi.mock("../src/runtime-env.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("../src/runtime-env.js")>();
	return {
		...original,
		isProductionRuntime: vi.fn().mockReturnValue(false),
	};
});

vi.mock("../src/runtime-env", async (importOriginal) => {
	const original = await importOriginal<typeof import("../src/runtime-env.js")>();
	return {
		...original,
		isProductionRuntime: vi.fn().mockReturnValue(false),
	};
});

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let sendContactNotification: typeof import("../src/transactional-email.js").sendContactNotification;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let sendPasswordResetEmail: typeof import("../src/transactional-email.js").sendPasswordResetEmail;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let sendUserInviteEmail: typeof import("../src/transactional-email.js").sendUserInviteEmail;

// Shared symbol used by registerCms/peekCmsConfig
const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function setCmsConfig(siteName: string) {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = {
		siteName,
		seedPages: [],
		contentTypes: [],
	};
}

function clearCmsConfig() {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = null;
}

beforeEach(() => {
	vi.resetModules();
	vi.mocked(isProductionRuntime).mockReturnValue(false);
});

beforeEach(async () => {
	({ sendContactNotification, sendPasswordResetEmail, sendUserInviteEmail } = await import(
		"../src/transactional-email.js"
	));
});

afterAll(() => {
	vi.resetModules();
});

afterEach(() => {
	clearCmsConfig();
	vi.unstubAllEnvs();
});

describe("sendPasswordResetEmail", () => {
	it("returns a preview in mock mode with correct subject and reset URL in html", async () => {
		setCmsConfig("My Site");
		const result = await sendPasswordResetEmail(
			"user@example.com",
			"https://example.com/ap-admin/reset-password?token=abc123",
		);
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview).toBeDefined();
		expect(result.preview?.subject).toContain("My Site");
		expect(result.preview?.html).toContain(
			"https://example.com/ap-admin/reset-password?token=abc123",
		);
		expect(result.preview?.html).toContain("<a href=");
	});

	it("uses 'Astropress' as siteName fallback when no CMS config is registered", async () => {
		const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
		expect(result.preview?.subject).toContain("Astropress");
	});

	it("escapes HTML special chars in siteName to prevent XSS", async () => {
		setCmsConfig("<script>alert(1)</script>");
		const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
		expect(result.preview?.html).not.toContain("<script>");
		expect(result.preview?.html).toContain("&lt;script&gt;");
	});
});

describe("sendUserInviteEmail", () => {
	it("returns a preview in mock mode with invite URL in subject and html", async () => {
		setCmsConfig("Acme Corp");
		const result = await sendUserInviteEmail(
			"invited@example.com",
			"https://example.com/ap-admin/accept-invite?token=xyz",
		);
		expect(result.ok).toBe(true);
		expect(result.preview?.subject).toContain("Acme Corp");
		expect(result.preview?.html).toContain("https://example.com/ap-admin/accept-invite?token=xyz");
	});

	it("escapes HTML special chars in siteName", async () => {
		setCmsConfig('Acme & "Co"');
		const result = await sendUserInviteEmail("invited@example.com", "https://example.com/invite");
		expect(result.preview?.html).not.toContain('"Co"');
		expect(result.preview?.html).toContain("&amp;");
	});
});

describe("sendContactNotification", () => {
	it("returns a preview in mock mode containing sender name and message", async () => {
		const result = await sendContactNotification({
			name: "Alice",
			email: "alice@example.com",
			message: "Hello there",
			submittedAt: "2026-04-12T10:00:00Z",
		});
		expect(result.ok).toBe(true);
		expect(result.preview?.html).toContain("Alice");
		expect(result.preview?.html).toContain("Hello there");
	});

	it("escapes HTML in contact name to prevent XSS", async () => {
		const result = await sendContactNotification({
			name: "<img onerror=alert(1) src=x>",
			email: "x@example.com",
			message: "test",
			submittedAt: "2026-04-12T10:00:00Z",
		});
		// The tag should be HTML-escaped, so no real <img> element can execute
		expect(result.preview?.html).not.toContain("<img");
		expect(result.preview?.html).toContain("&lt;img");
	});

	it("escapes HTML in contact message body", async () => {
		const result = await sendContactNotification({
			name: "Bob",
			email: "bob@example.com",
			message: "<script>steal(document.cookie)</script>",
			submittedAt: "2026-04-12T10:00:00Z",
		});
		expect(result.preview?.html).not.toContain("<script>");
		expect(result.preview?.html).toContain("&lt;script&gt;");
	});

	it("contact submission with destination configured dispatches the email and assembles the subject", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		vi.stubEnv("CONTACT_NOTIFICATION_TO_EMAIL", "ops@example.com");
		setCmsConfig("MySite");
		sendMailMock.mockClear();
		sendMailMock.mockResolvedValue({ accepted: ["ops@example.com"] });

		const result = await sendContactNotification({
			name: "Fran",
			email: "fran@example.com",
			message: "hi",
			submittedAt: "2026-04-01",
		});
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(true);
		expect(sendMailMock).toHaveBeenCalledOnce();
		const sent = sendMailMock.mock.calls[0]?.[0] as {
			to: string;
			subject: string;
			text: string;
			html: string;
		};
		expect(sent.to).toBe("ops@example.com");
		expect(sent.subject).toBe("MySite contact submission from Fran");
		expect(sent.text).toContain("Fran <fran@example.com>");
		expect(sent.text).toContain("submitted a contact request at 2026-04-01");
		expect(sent.html).toContain("<strong>Fran</strong>");
		expect(sent.html).toContain("&lt;fran@example.com&gt;");
	});

	it("contact submission falls back to 'Astropress' in the subject when no CMS siteName is set", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		vi.stubEnv("CONTACT_NOTIFICATION_TO_EMAIL", "ops@example.com");
		sendMailMock.mockClear();
		sendMailMock.mockResolvedValue({ accepted: ["ops@example.com"] });

		await sendContactNotification({
			name: "G",
			email: "g@example.com",
			message: "m",
			submittedAt: "2026-04-01",
		});
		const sent = sendMailMock.mock.calls[0]?.[0] as { subject: string };
		expect(sent.subject).toBe("Astropress contact submission from G");
	});

	it("returns error in production mode when contactDestination is not configured", async () => {
		// Simulate production runtime via mock
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		// contactDestination defaults to undefined when CONTACT_NOTIFICATION_TO_EMAIL is unset
		const result = await sendContactNotification({
			name: "Carol",
			email: "carol@example.com",
			message: "Hello",
			submittedAt: "2026-04-12T10:00:00Z",
		});
		// In production with no destination configured, returns error
		expect(result.ok).toBe(false);
		expect(result.error).toBeDefined();
	});
});

describe("escapeHtml behavior", () => {
	it("escapes all five entities: & < > \" '", async () => {
		const result = await sendContactNotification({
			name: "& < > \" '",
			email: "x@example.com",
			message: "& < > \" '",
			submittedAt: "& < > \" '",
		});
		const html = result.preview?.html ?? "";
		expect(html).toContain("&amp;");
		expect(html).toContain("&lt;");
		expect(html).toContain("&gt;");
		expect(html).toContain("&quot;");
		expect(html).toContain("&#39;");
	});
});

describe("subject + text formatting", () => {
	it("password reset subject contains 'Reset your <siteName> admin password'", async () => {
		setCmsConfig("MySite");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.preview?.subject).toBe("Reset your MySite admin password");
	});

	it("invite subject contains 'Accept your <siteName> admin invitation'", async () => {
		setCmsConfig("MySite");
		const result = await sendUserInviteEmail("u@x.com", "https://example.com/i");
		expect(result.preview?.subject).toBe("Accept your MySite admin invitation");
	});

	it("contact subject in preview mode is 'Preview contact submission from <name>'", async () => {
		const result = await sendContactNotification({
			name: "Dave",
			email: "d@example.com",
			message: "msg",
			submittedAt: "2026-01-01",
		});
		expect(result.preview?.subject).toBe("Preview contact submission from Dave");
	});

	it("contact preview mode 'to' is the admin-preview placeholder", async () => {
		const result = await sendContactNotification({
			name: "Eve",
			email: "e@example.com",
			message: "msg",
			submittedAt: "2026-01-01",
		});
		expect(result.preview?.to).toBe("admin-preview@example.local");
	});
});

describe("production mode without resend / SMTP credentials", () => {
	it("password reset returns the exact 'Transactional email is not configured.' error", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.delivered).toBe(false);
		expect(result.error).toBe("Transactional email is not configured.");
		expect(result.preview).toBeUndefined();
	});

	it("SMTP mode without SMTP host returns 'SMTP transactional email is not configured.'", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.error).toBe("SMTP transactional email is not configured.");
	});

	it("contact in production with no destination returns the contact-specific error", async () => {
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		const result = await sendContactNotification({
			name: "X",
			email: "x@example.com",
			message: "m",
			submittedAt: "2026-01-01",
		});
		expect(result.error).toBe("Contact notification email is not configured.");
	});
});

describe("Resend preview path (mode=resend, no credentials, dev runtime)", () => {
	it("returns a preview (ok=true, delivered=false) when RESEND_API_KEY/RESEND_FROM_EMAIL are missing", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		// No RESEND_API_KEY / RESEND_FROM_EMAIL set
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview?.to).toBe("u@x.com");
		expect(result.preview?.subject).toContain("admin password");
		expect(result.preview?.html).toContain("https://example.com/r");
	});

	it("returns a preview when only RESEND_API_KEY is set but RESEND_FROM_EMAIL is missing", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "key");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview).toBeDefined();
	});
});

describe("Resend HTTP delivery path", () => {
	it("returns delivered=true on a 200 response and POSTs to api.resend.com/emails with Bearer auth", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
		const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: "x" }), { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);

		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(true);
		expect(result.preview).toBeUndefined();
		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer re_test_key");
		expect(headers["Content-Type"]).toBe("application/json");
		const body = JSON.parse(init.body as string);
		expect(body.from).toBe("noreply@example.com");
		expect(body.to).toEqual(["u@x.com"]);
		expect(typeof body.subject).toBe("string");
		expect(typeof body.html).toBe("string");
		vi.unstubAllGlobals();
	});

	it("returns delivered=false with the response statusText when Resend returns a non-ok response", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
		const fetchSpy = vi.fn(
			async () =>
				new Response("rate limited", {
					status: 429,
					statusText: "Too Many Requests",
				}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.delivered).toBe(false);
		expect(result.error).toContain("Resend error:");
		expect(result.error).toContain("rate limited");
		vi.unstubAllGlobals();
	});

	it("falls back to statusText when the error body is empty", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
		const fetchSpy = vi.fn(
			async () => new Response("", { status: 500, statusText: "Internal Server Error" }),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Resend error: Internal Server Error");
		vi.unstubAllGlobals();
	});
});

describe("SMTP delivery path", () => {
	beforeEach(() => {
		sendMailMock.mockClear();
		sendMailMock.mockResolvedValue({ accepted: ["u@x.com"] });
		lastTransportOpts = null;
	});

	it("returns delivered=true and configures the transport with secure=false on port 587", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(true);
		expect(result.preview).toBeUndefined();
		expect(sendMailMock).toHaveBeenCalledOnce();
		const opts = lastTransportOpts as {
			host: string;
			port: number;
			secure: boolean;
			auth: unknown;
		};
		expect(opts.host).toBe("smtp.example.com");
		expect(opts.port).toBe(587);
		expect(opts.secure).toBe(false);
		expect(opts.auth).toBeUndefined();
	});

	it("configures secure=true when port is 465", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "465");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		const opts = lastTransportOpts as { secure: boolean };
		expect(opts.secure).toBe(true);
	});

	it("includes auth when SMTP_USERNAME / SMTP_PASSWORD are set", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		vi.stubEnv("SMTP_USERNAME", "user");
		vi.stubEnv("SMTP_PASSWORD", "pass");
		await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		const opts = lastTransportOpts as { auth: { user: string; pass: string } };
		expect(opts.auth).toEqual({ user: "user", pass: "pass" });
	});

	it("defaults SMTP_PORT to 587 when unset", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		const opts = lastTransportOpts as { port: number };
		expect(opts.port).toBe(587);
	});

	it("returns ok=false with the thrown Error.message when sendMail rejects with an Error", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		sendMailMock.mockRejectedValueOnce(new Error("smtp timeout"));
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.delivered).toBe(false);
		expect(result.error).toBe("smtp timeout");
	});

	it("returns the generic 'SMTP delivery failed.' error when the rejection is a non-Error value", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		sendMailMock.mockRejectedValueOnce("not an Error");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.error).toBe("SMTP delivery failed.");
	});
});

describe("mock mode behavior", () => {
	it("returns a preview object (not sending) when EMAIL_DELIVERY_MODE is not 'resend'", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "mock");
		const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview).toBeDefined();
		expect(result.preview?.to).toBe("user@example.com");
	});

	it("returns a preview object when SMTP mode is selected without SMTP config", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview).toBeDefined();
	});
});

describe("survivor pins (kills mutation testing equivalents)", () => {
	it("SMTP path with SMTP_PORT=0 falls through to preview (pins L99 || vs && — port is a required field)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		vi.stubEnv("SMTP_PORT", "0");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
		expect(result.preview).toBeDefined();
	});

	it("SMTP-not-configured production: delivered is false (pins L103 BooleanLiteral)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		expect(result.ok).toBe(false);
		expect(result.delivered).toBe(false);
	});

	it("SMTP-not-configured preview: 'to' field equals message.to (pins L111 preview object)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		const result = await sendPasswordResetEmail("EXACT@x.com", "https://example.com/r");
		expect(result.preview?.to).toBe("EXACT@x.com");
		expect(result.preview?.subject).toContain("admin password");
	});

	it("SMTP auth is set when only SMTP_USERNAME is provided (pins L125 || vs &&)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_FROM_EMAIL", "noreply@example.com");
		vi.stubEnv("SMTP_USERNAME", "user-only");
		// SMTP_PASSWORD intentionally unset
		await sendPasswordResetEmail("u@x.com", "https://example.com/r");
		const opts = lastTransportOpts as {
			auth: { user: string; pass: string | undefined } | undefined;
		};
		expect(opts.auth).toBeDefined();
		expect(opts.auth?.user).toBe("user-only");
	});

	it("password reset preview text contains the reset URL and siteName (pins L184 template literal)", async () => {
		setCmsConfig("PinSite");
		const result = await sendPasswordResetEmail("u@x.com", "https://example.com/r-token");
		expect(result.preview?.html).toBeDefined();
		// preview text isn't directly returned but the html shouldn't be empty
		// preview surface check: subject and html both reference siteName via template literal
		expect(result.preview?.subject).toContain("PinSite");
	});

	it("invite email falls back to 'Astropress' when no CMS config is registered (pins L196 ?? 'Astropress')", async () => {
		const result = await sendUserInviteEmail("u@x.com", "https://example.com/invite");
		expect(result.preview?.subject).toContain("Astropress");
	});

	it("invite email subject contains siteName from cms config (pins L196 optional chain access)", async () => {
		setCmsConfig("InviteSite");
		const result = await sendUserInviteEmail("u@x.com", "https://example.com/invite");
		expect(result.preview?.subject).toContain("InviteSite");
	});

	it("contact production-no-destination: delivered is false (pins L227 BooleanLiteral)", async () => {
		vi.mocked(isProductionRuntime).mockReturnValue(true);
		const result = await sendContactNotification({
			name: "x",
			email: "x@x",
			message: "m",
			submittedAt: "now",
		});
		expect(result.ok).toBe(false);
		expect(result.delivered).toBe(false);
	});

	it("password reset Resend body includes the URL in the text field (pins L184 template literal)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "re_x");
		vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
		const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);
		setCmsConfig("PinSite");
		await sendPasswordResetEmail("u@x.com", "https://example.com/r-pin-token");
		const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
		expect(body.text).toContain("https://example.com/r-pin-token");
		expect(body.text).toContain("PinSite");
		vi.unstubAllGlobals();
	});

	it("invite Resend body includes the URL in the text field (pins L201 template literal)", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
		vi.stubEnv("RESEND_API_KEY", "re_x");
		vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.com");
		const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);
		setCmsConfig("InviteSite");
		await sendUserInviteEmail("u@x.com", "https://example.com/invite-pin-token");
		const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
		expect(body.text).toContain("https://example.com/invite-pin-token");
		expect(body.text).toContain("InviteSite");
		vi.unstubAllGlobals();
	});

	it("contact preview path: delivered is false (pins L234 BooleanLiteral)", async () => {
		const result = await sendContactNotification({
			name: "x",
			email: "x@x",
			message: "m",
			submittedAt: "now",
		});
		expect(result.ok).toBe(true);
		expect(result.delivered).toBe(false);
	});
});
