import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Playwright mock
// ---------------------------------------------------------------------------

type MockPage = {
	goto: ReturnType<typeof vi.fn>;
	fill: ReturnType<typeof vi.fn>;
	click: ReturnType<typeof vi.fn>;
	waitForURL: ReturnType<typeof vi.fn>;
	url: ReturnType<typeof vi.fn>;
	locator: ReturnType<typeof vi.fn>;
	waitForSelector: ReturnType<typeof vi.fn>;
	waitForEvent: ReturnType<typeof vi.fn>;
	content: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
	const page: MockPage = {
		goto: vi.fn(),
		fill: vi.fn(),
		click: vi.fn(),
		waitForURL: vi.fn(),
		url: vi.fn(),
		locator: vi.fn(),
		waitForSelector: vi.fn(),
		waitForEvent: vi.fn(),
		content: vi.fn(),
	};

	const context = {
		newPage: vi.fn().mockResolvedValue(page),
		close: vi.fn(),
	};

	const browser = {
		newContext: vi.fn().mockResolvedValue(context),
		close: vi.fn(),
	};

	return { page, context, browser };
});

vi.mock("playwright", () => ({
	chromium: {
		launch: vi.fn().mockResolvedValue(mocks.browser),
	},
}));

import { chromium } from "playwright";
import {
	BotDetectionError,
	CaptchaDetectedError,
	fetchWordPressExport,
	InsufficientPermissionsError,
	InvalidCredentialsError,
	NotWordPressSiteError,
	SiteNotReachableError,
	TwoFactorRequiredError,
} from "../../src/import/fetch-wordpress.js";

const BASE_OPTS = {
	siteUrl: "https://mysite.com",
	username: "admin",
	password: "secret",
	downloadDir: "/tmp/wp-downloads",
};

function makeLocator(opts: { count?: number; exists?: boolean } = {}) {
	return {
		count: vi.fn().mockResolvedValue(opts.count ?? 0),
		first: vi.fn().mockReturnThis(),
		click: vi.fn(),
		waitFor: vi.fn(),
	};
}

function setupBrowserChain() {
	vi.mocked(chromium.launch).mockResolvedValue(mocks.browser as never);
	mocks.browser.newContext.mockResolvedValue(mocks.context);
	mocks.context.newPage.mockResolvedValue(mocks.page);
	// Safe defaults — individual tests can override
	mocks.page.content.mockResolvedValue("<html></html>");
	mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");
	mocks.page.locator.mockReturnValue(makeLocator({ count: 0 }));
	mocks.page.goto.mockResolvedValue({ status: () => 200 });
}

describe("fetchWordPressExport — success path", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setupBrowserChain();

		// goto succeeds
		mocks.page.goto.mockResolvedValue({ status: () => 200 });

		// login page looks like WordPress
		mocks.page.content.mockResolvedValue(
			'<html><body><form id="loginform"><input id="user_login" /><input id="user_pass" /></form></body></html>',
		);

		// after login submit, URL changes to dashboard (not still on login page)
		mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");

		// export page: no 2FA, no CAPTCHA, has export link
		mocks.page.locator.mockImplementation((sel: string) => {
			if (sel.includes("two-factor") || sel.includes("mfa") || sel.includes("captcha")) {
				return makeLocator({ count: 0 });
			}
			return makeLocator({ count: 1 });
		});

		// download event
		mocks.page.waitForEvent.mockResolvedValue({
			suggestedFilename: () => "wordpress-export.xml",
			saveAs: vi.fn(),
		});
	});

	it("navigates to wp-login.php, fills credentials, and submits", async () => {
		await fetchWordPressExport(BASE_OPTS);
		expect(mocks.page.goto).toHaveBeenCalledWith(
			expect.stringContaining("wp-login.php"),
			expect.any(Object),
		);
		expect(mocks.page.fill).toHaveBeenCalledWith("#user_login", "admin");
		expect(mocks.page.fill).toHaveBeenCalledWith("#user_pass", "secret");
		expect(mocks.page.click).toHaveBeenCalledWith("#wp-submit");
	});

	it("returns the path to the downloaded export file with an empty warnings array", async () => {
		const result = await fetchWordPressExport(BASE_OPTS);
		expect(result.exportPath).toContain("wordpress-export.xml");
		expect(result.warnings).toEqual([]);
	});

	it("navigates to wp-admin/export.php with timeout + waitUntil:'domcontentloaded'", async () => {
		await fetchWordPressExport(BASE_OPTS);
		const exportCall = mocks.page.goto.mock.calls.find(
			([url]) => typeof url === "string" && url.endsWith("/wp-admin/export.php"),
		);
		expect(exportCall).toBeDefined();
		expect(exportCall?.[0]).toBe("https://mysite.com/wp-admin/export.php");
		expect(exportCall?.[1]).toMatchObject({
			timeout: expect.any(Number),
			waitUntil: "domcontentloaded",
		});
	});

	it("does NOT click submit when the #submit locator's count is 0 (download still proceeds via waitForEvent)", async () => {
		const submitLocator = makeLocator({ count: 0 });
		mocks.page.locator.mockImplementation((sel: string) => {
			if (sel === "#submit") return submitLocator;
			if (sel.includes("authcode") || sel.includes("mfa") || sel.includes("two-factor")) {
				return makeLocator({ count: 0 });
			}
			return makeLocator({ count: 1 });
		});
		await fetchWordPressExport(BASE_OPTS);
		expect(submitLocator.click).not.toHaveBeenCalled();
	});

	it("requests the page's #submit locator AND clicks it when the count is > 0", async () => {
		const submitLocator = makeLocator({ count: 1 });
		// Override the locator implementation so we can spy on the #submit locator specifically
		// while still returning count=0 for 2FA selectors.
		mocks.page.locator.mockImplementation((sel: string) => {
			if (sel === "#submit") return submitLocator;
			if (sel.includes("authcode") || sel.includes("mfa") || sel.includes("two-factor")) {
				return makeLocator({ count: 0 });
			}
			return makeLocator({ count: 1 });
		});
		await fetchWordPressExport(BASE_OPTS);
		expect(mocks.page.locator).toHaveBeenCalledWith("#submit");
		expect(submitLocator.click).toHaveBeenCalled();
	});

	it("waits for the 'download' event with a timeout option", async () => {
		await fetchWordPressExport(BASE_OPTS);
		expect(mocks.page.waitForEvent).toHaveBeenCalledWith(
			"download",
			expect.objectContaining({ timeout: expect.any(Number) }),
		);
	});

	it("creates the browser context with acceptDownloads enabled", async () => {
		await fetchWordPressExport(BASE_OPTS);
		expect(mocks.browser.newContext).toHaveBeenCalledWith({ acceptDownloads: true });
	});

	it("closes the browser even on success", async () => {
		await fetchWordPressExport(BASE_OPTS);
		expect(mocks.browser.close).toHaveBeenCalled();
	});
});

describe("fetchWordPressExport — failure modes", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setupBrowserChain();
	});

	it("throws SiteNotReachableError when goto fails with network error", async () => {
		mocks.page.goto.mockRejectedValue(
			Object.assign(new Error("net::ERR_NAME_NOT_RESOLVED"), { name: "Error" }),
		);
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(SiteNotReachableError);
	});

	it("SiteNotReachableError message names the hostname", async () => {
		mocks.page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED mysite.com"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: DNS lookup failed",
		);
	});

	it("throws NotWordPressSiteError when wp-login.php is not found", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 404 });
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(NotWordPressSiteError);
	});

	it("throws NotWordPressSiteError with clear message", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 404 });
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"does not appear to be a WordPress site",
		);
	});

	it("throws InvalidCredentialsError when still on login page after submit", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue(
			'<html><body><div id="login_error">Error: The password you entered</div><form id="loginform"></form></body></html>',
		);
		mocks.page.url.mockReturnValue("https://mysite.com/wp-login.php");

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("InvalidCredentialsError has a clear human-readable message", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue(
			'<form id="loginform"><div id="login_error">wrong</div></form>',
		);
		mocks.page.url.mockReturnValue("https://mysite.com/wp-login.php");

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Login failed: username or password was incorrect",
		);
	});

	it("throws TwoFactorRequiredError when 2FA form is detected", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue('<html><form id="loginform"></form></html>');
		mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");
		mocks.page.locator.mockImplementation((sel: string) => {
			if (sel.includes("two-factor") || sel.includes("authcode")) {
				return makeLocator({ count: 1 });
			}
			return makeLocator({ count: 0 });
		});

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(TwoFactorRequiredError);
	});

	it("TwoFactorRequiredError message tells user to use --source instead", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue('<html><form id="loginform"></form></html>');
		mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");
		mocks.page.locator.mockImplementation((sel: string) =>
			makeLocator({ count: sel.includes("authcode") ? 1 : 0 }),
		);

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Two-factor authentication is required",
		);
	});

	it("throws CaptchaDetectedError when login page has CAPTCHA", async () => {
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue(
			'<html><form id="loginform"><div class="g-recaptcha"></div></form></html>',
		);
		mocks.page.url.mockReturnValue("https://mysite.com/wp-login.php");

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(CaptchaDetectedError);
	});

	it("throws InsufficientPermissionsError when export.php redirects back to login", async () => {
		mocks.page.goto
			.mockResolvedValueOnce({ status: () => 200 }) // wp-login.php
			.mockResolvedValueOnce({ status: () => 200 }); // export.php redirects
		mocks.page.content.mockResolvedValue('<html><form id="loginform"></form></html>');
		mocks.page.url
			.mockReturnValueOnce("https://mysite.com/wp-admin/") // after login
			.mockReturnValueOnce("https://mysite.com/wp-login.php"); // after navigating to export
		mocks.page.locator.mockReturnValue(makeLocator({ count: 0 }));

		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(
			InsufficientPermissionsError,
		);
	});

	it("always closes the browser even when an error is thrown", async () => {
		mocks.page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow();
		expect(mocks.browser.close).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Exact error-class name and message assertions (kill StringLiteral mutants
// on `override name` and the constructor super(...) messages).
// ---------------------------------------------------------------------------

describe("typed Error classes — exact name and message", () => {
	it("SiteNotReachableError has name='SiteNotReachableError' and the documented hostname:reason format", () => {
		const err = new SiteNotReachableError("example.com", "boom");
		expect(err.name).toBe("SiteNotReachableError");
		expect(err.message).toBe("Cannot reach example.com: boom");
	});

	it("NotWordPressSiteError has name='NotWordPressSiteError' and references the URL with the documented message", () => {
		const err = new NotWordPressSiteError("https://x.test");
		expect(err.name).toBe("NotWordPressSiteError");
		expect(err.message).toBe(
			"The URL does not appear to be a WordPress site — wp-login.php was not found at https://x.test",
		);
	});

	it("InvalidCredentialsError has name='InvalidCredentialsError' and the documented message", () => {
		const err = new InvalidCredentialsError();
		expect(err.name).toBe("InvalidCredentialsError");
		expect(err.message).toBe("Login failed: username or password was incorrect");
	});

	it("TwoFactorRequiredError has name='TwoFactorRequiredError' and the documented message", () => {
		const err = new TwoFactorRequiredError();
		expect(err.name).toBe("TwoFactorRequiredError");
		expect(err.message).toBe(
			"Two-factor authentication is required — export the file manually and use --source",
		);
	});

	it("CaptchaDetectedError has name='CaptchaDetectedError' and both documented lines of guidance", () => {
		const err = new CaptchaDetectedError();
		expect(err.name).toBe("CaptchaDetectedError");
		expect(err.message).toContain("CAPTCHA detected — the site requires human verification.");
		expect(err.message).toContain(
			"Export the file manually via Tools → Export in your WordPress dashboard and use --source.",
		);
	});

	it("BotDetectionError has name='BotDetectionError' and both documented lines of guidance", () => {
		const err = new BotDetectionError();
		expect(err.name).toBe("BotDetectionError");
		expect(err.message).toContain(
			"Bot detection triggered (Cloudflare or similar security layer).",
		);
		expect(err.message).toContain(
			"Export the file manually via Tools → Export in your WordPress dashboard and use --source.",
		);
	});

	it("InsufficientPermissionsError has name='InsufficientPermissionsError' and both documented lines of guidance", () => {
		const err = new InsufficientPermissionsError();
		expect(err.name).toBe("InsufficientPermissionsError");
		expect(err.message).toContain("Insufficient permissions");
		expect(err.message).toContain(
			"Log into WordPress, go to Users → Your Profile, and confirm the role is Administrator.",
		);
	});
});

// ---------------------------------------------------------------------------
// classifyNetworkError — exercised via fetchWordPressExport with goto rejections
// ---------------------------------------------------------------------------

describe("classifyNetworkError (via goto rejection)", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setupBrowserChain();
	});

	it("classifies ERR_CONNECTION_REFUSED as the documented 'connection refused' reason", async () => {
		mocks.page.goto.mockRejectedValue(new Error("net::ERR_CONNECTION_REFUSED"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: connection refused — is the site running?",
		);
	});

	it("classifies ERR_CERT_* / SSL / certificate errors as the documented SSL reason", async () => {
		mocks.page.goto.mockRejectedValue(new Error("net::ERR_CERT_AUTHORITY_INVALID"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: SSL/TLS error — try using http:// instead of https://",
		);
	});

	it("classifies TIMEOUT errors (case-insensitive) as the documented timed-out reason", async () => {
		mocks.page.goto.mockRejectedValue(new Error("Navigation TIMEOUT exceeded"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: timed out — the server took too long to respond",
		);
	});

	it("classifies EAI_AGAIN as the documented DNS-lookup-failed reason", async () => {
		mocks.page.goto.mockRejectedValue(new Error("getaddrinfo EAI_AGAIN mysite.com"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: DNS lookup failed — check the site URL is correct",
		);
	});

	it("falls back to the raw error message verbatim when no classifier matches", async () => {
		mocks.page.goto.mockRejectedValue(new Error("strange unknown problem"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: strange unknown problem",
		);
	});

	it("stringifies non-Error rejection values via String(err)", async () => {
		mocks.page.goto.mockRejectedValue("plain-string-rejection");
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow(
			"Cannot reach mysite.com: plain-string-rejection",
		);
	});
});

// ---------------------------------------------------------------------------
// isBotBlocked — every cf-* token triggers BotDetectionError independently
// ---------------------------------------------------------------------------

describe("isBotBlocked (via login-page content)", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setupBrowserChain();
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.url.mockReturnValue("https://mysite.com/wp-login.php");
	});

	const tokens = [
		"cf-browser-verification",
		"cf-challenge",
		"cf-spinner",
		"window._cf_chl_opt",
		"__cf_chl_jschl_tk__",
	];
	for (const token of tokens) {
		it(`throws BotDetectionError when the login page contains '${token}' (NOT CaptchaDetectedError)`, async () => {
			mocks.page.content.mockResolvedValue(
				`<html><body><form id="loginform"></form><script>${token}</script></body></html>`,
			);
			await expect(fetchWordPressExport({ ...BASE_OPTS, headless: false })).rejects.toBeInstanceOf(
				BotDetectionError,
			);
		});
	}
});

// ---------------------------------------------------------------------------
// Public API — headless retry semantics
// ---------------------------------------------------------------------------

describe("fetchWordPressExport — headless retry on bot detection", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setupBrowserChain();
	});

	it("with headless=false explicit, skips the headless attempt and runs visible-only", async () => {
		const launch = vi.mocked(chromium.launch);
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		mocks.page.content.mockResolvedValue('<form id="loginform"></form>');
		mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");
		mocks.page.locator.mockImplementation((sel: string) =>
			makeLocator({
				count:
					sel.includes("authcode") || sel.includes("mfa") || sel.includes("two-factor") ? 0 : 1,
			}),
		);
		mocks.page.waitForEvent.mockResolvedValue({
			suggestedFilename: () => "x.xml",
			saveAs: vi.fn(),
		});

		await fetchWordPressExport({ ...BASE_OPTS, headless: false });
		// Single launch with headless: false — no headless first-pass.
		expect(launch).toHaveBeenCalledTimes(1);
		expect(launch).toHaveBeenCalledWith({ headless: false });
	});

	it("retries with headless=false after a headless BotDetectionError, and writes the documented stderr notice", async () => {
		const launch = vi.mocked(chromium.launch);
		// Both attempts succeed past initial nav; the FIRST attempt's content trips bot detection.
		mocks.page.goto.mockResolvedValue({ status: () => 200 });
		const captchaContent = '<form id="loginform"></form><script>cf-challenge</script>';
		const cleanContent = '<form id="loginform"></form>';
		// First call (headless pass): bot-blocked content
		// Subsequent calls (visible retry): clean content
		mocks.page.content.mockResolvedValueOnce(captchaContent).mockResolvedValue(cleanContent);
		mocks.page.url.mockReturnValue("https://mysite.com/wp-admin/");
		mocks.page.locator.mockImplementation((sel: string) =>
			makeLocator({
				count:
					sel.includes("authcode") || sel.includes("mfa") || sel.includes("two-factor") ? 0 : 1,
			}),
		);
		mocks.page.waitForEvent.mockResolvedValue({
			suggestedFilename: () => "x.xml",
			saveAs: vi.fn(),
		});

		const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		await fetchWordPressExport(BASE_OPTS);

		expect(launch).toHaveBeenCalledTimes(2);
		expect(launch).toHaveBeenNthCalledWith(1, { headless: true });
		expect(launch).toHaveBeenNthCalledWith(2, { headless: false });

		const allWrites = stderrWrite.mock.calls.map((c) => String(c[0])).join("");
		expect(allWrites).toContain(
			"[astropress] Bot detection or CAPTCHA triggered in headless mode.",
		);
		expect(allWrites).toContain(
			"[astropress] Opening a visible browser — please solve any challenge that appears,",
		);
		expect(allWrites).toContain("[astropress] then the export will continue automatically.");
		stderrWrite.mockRestore();
	});

	it("does NOT retry when the headless attempt throws a non-bot-detection error", async () => {
		const launch = vi.mocked(chromium.launch);
		mocks.page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));
		await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(SiteNotReachableError);
		expect(launch).toHaveBeenCalledTimes(1);
	});
});
