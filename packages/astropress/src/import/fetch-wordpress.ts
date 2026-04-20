import { mkdir } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export class SiteNotReachableError extends Error {
	override name = "SiteNotReachableError";
	constructor(hostname: string, reason: string) {
		super(`Cannot reach ${hostname}: ${reason}`);
	}
}

export class NotWordPressSiteError extends Error {
	override name = "NotWordPressSiteError";
	constructor(url: string) {
		super(
			`The URL does not appear to be a WordPress site — wp-login.php was not found at ${url}`,
		);
	}
}

export class InvalidCredentialsError extends Error {
	override name = "InvalidCredentialsError";
	constructor() {
		super("Login failed: username or password was incorrect");
	}
}

export class TwoFactorRequiredError extends Error {
	override name = "TwoFactorRequiredError";
	constructor() {
		super(
			"Two-factor authentication is required — export the file manually and use --source",
		);
	}
}

export class CaptchaDetectedError extends Error {
	override name = "CaptchaDetectedError";
	constructor() {
		super(
			"CAPTCHA detected — the site requires human verification.\n" +
				"Export the file manually via Tools → Export in your WordPress dashboard and use --source.",
		);
	}
}

export class BotDetectionError extends Error {
	override name = "BotDetectionError";
	constructor() {
		super(
			"Bot detection triggered (Cloudflare or similar security layer).\n" +
				"Export the file manually via Tools → Export in your WordPress dashboard and use --source.",
		);
	}
}

export class InsufficientPermissionsError extends Error {
	override name = "InsufficientPermissionsError";
	constructor() {
		super(
			"Insufficient permissions — the account needs Administrator access to export content.\n" +
				"Log into WordPress, go to Users → Your Profile, and confirm the role is Administrator.",
		);
	}
}

// ---------------------------------------------------------------------------
// Options / Result
// ---------------------------------------------------------------------------

export type WordPressFetchOptions = {
	siteUrl: string;
	username: string;
	password: string;
	downloadDir: string;
	headless?: boolean;
	timeoutMs?: number;
};

export type WordPressFetchResult = {
	exportPath: string;
	warnings: string[];
};

// ---------------------------------------------------------------------------
// Lazy Playwright loader
// ---------------------------------------------------------------------------

async function requirePlaywright() {
	try {
		return await import("playwright");
	} catch {
		throw new Error(
			"Browser automation requires Playwright.\n" +
				"Install it with:  bun add playwright && bunx playwright install chromium\n" +
				"Or export the file manually and use --source.",
		);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyNetworkError(
	err: unknown,
	hostname: string,
): SiteNotReachableError {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes("ERR_NAME_NOT_RESOLVED") || msg.includes("EAI_AGAIN")) {
		return new SiteNotReachableError(
			hostname,
			"DNS lookup failed — check the site URL is correct",
		);
	}
	if (msg.includes("ERR_CONNECTION_REFUSED")) {
		return new SiteNotReachableError(
			hostname,
			"connection refused — is the site running?",
		);
	}
	if (
		msg.includes("ERR_CERT_") ||
		msg.includes("SSL") ||
		msg.includes("certificate")
	) {
		return new SiteNotReachableError(
			hostname,
			"SSL/TLS error — try using http:// instead of https://",
		);
	}
	if (msg.toLowerCase().includes("timeout")) {
		return new SiteNotReachableError(
			hostname,
			"timed out — the server took too long to respond",
		);
	}
	return new SiteNotReachableError(hostname, msg);
}

function isBotBlocked(content: string): boolean {
	return (
		content.includes("cf-browser-verification") ||
		content.includes("cf-challenge") ||
		content.includes("cf-spinner") ||
		content.includes("window._cf_chl_opt") ||
		content.includes("__cf_chl_jschl_tk__")
	);
}

// ---------------------------------------------------------------------------
// Single-attempt implementation (internal)
// ---------------------------------------------------------------------------

async function attemptWordPressExport(
	opts: WordPressFetchOptions & { headless: boolean },
): Promise<WordPressFetchResult> {
	const {
		siteUrl,
		username,
		password,
		downloadDir,
		headless,
		timeoutMs = 30_000,
	} = opts;

	const pw = await requirePlaywright();
	const browser = await pw.chromium.launch({ headless });
	const warnings: string[] = [];

	try {
		const context = await browser.newContext({ acceptDownloads: true });
		const page = await context.newPage();

		const loginUrl = `${siteUrl.replace(/\/$/, "")}/wp-login.php`;

		// 1. Navigate to wp-login.php
		let loginResponse: { status(): number };
		try {
			loginResponse = (await page.goto(loginUrl, {
				timeout: timeoutMs,
				waitUntil: "domcontentloaded",
			})) as typeof loginResponse;
		} catch (err) {
			throw classifyNetworkError(err, new URL(siteUrl).hostname);
		}

		if (!loginResponse || loginResponse.status() === 404) {
			throw new NotWordPressSiteError(siteUrl);
		}

		const loginContent = await page.content();

		// 2. Check for bot detection / CAPTCHA before attempting login
		if (isBotBlocked(loginContent)) {
			throw new BotDetectionError();
		}
		if (
			loginContent.includes("g-recaptcha") ||
			loginContent.includes("h-captcha")
		) {
			throw new CaptchaDetectedError();
		}

		// 3. Fill credentials and submit
		await page.fill("#user_login", username);
		await page.fill("#user_pass", password);
		await page.click("#wp-submit");

		// 4. Wait for navigation and check result

		// Check for 2FA (can appear on login page OR wp-admin via plugin redirect)
		const has2FA = await page
			.locator(
				"[name='authcode'], [name='two-factor-totp-authcode'], [name='mfa_token']",
			)
			.count();
		if (has2FA > 0) {
			throw new TwoFactorRequiredError();
		}

		// Still on login page without 2FA = wrong credentials
		const currentUrl = page.url();
		// audit-ok: Playwright page.url() is trusted browser state; checks path segment, not hostname
		if (currentUrl.includes("wp-login.php")) {
			throw new InvalidCredentialsError();
		}

		// 5. Navigate to export page
		const exportUrl = `${siteUrl.replace(/\/$/, "")}/wp-admin/export.php`;
		await page.goto(exportUrl, {
			timeout: timeoutMs,
			waitUntil: "domcontentloaded",
		});

		// Check if we got redirected back to login (no admin access)
		if (page.url().includes("wp-login.php")) {
			throw new InsufficientPermissionsError();
		}

		// 6. Download the export file
		await mkdir(downloadDir, { recursive: true });

		const downloadPromise = page.waitForEvent("download", {
			timeout: timeoutMs,
		});
		const submitBtn = page.locator("#submit");
		if ((await submitBtn.count()) > 0) {
			await submitBtn.first().click();
		}

		const download = await downloadPromise;
		const filename = download.suggestedFilename();
		const exportPath = path.join(downloadDir, filename);
		await download.saveAs(exportPath);

		return { exportPath, warnings };
	} finally {
		await browser.close();
	}
}

// ---------------------------------------------------------------------------
// Public API — auto-retries with visible browser on bot detection / CAPTCHA
// ---------------------------------------------------------------------------

export async function fetchWordPressExport(
	opts: WordPressFetchOptions,
): Promise<WordPressFetchResult> {
	// If caller explicitly requested a visible browser, skip the headless attempt.
	if (opts.headless === false) {
		return attemptWordPressExport({ ...opts, headless: false });
	}

	// First pass: headless (silent, fast).
	try {
		return await attemptWordPressExport({ ...opts, headless: true });
	} catch (err) {
		if (
			err instanceof CaptchaDetectedError ||
			err instanceof BotDetectionError
		) {
			process.stderr.write(
				"\n[astropress] Bot detection or CAPTCHA triggered in headless mode.\n" +
					"[astropress] Opening a visible browser — please solve any challenge that appears,\n" +
					"[astropress] then the export will continue automatically.\n\n",
			);
			// Second pass: visible browser — lets the user solve the challenge manually.
			return await attemptWordPressExport({ ...opts, headless: false });
		}
		throw err;
	}
}
