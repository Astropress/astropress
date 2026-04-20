import { mkdir } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export class WixInvalidCredentialsError extends Error {
	override name = "WixInvalidCredentialsError";
	constructor() {
		super("Login failed: incorrect email or password");
	}
}

export class WixTwoFactorRequiredError extends Error {
	override name = "WixTwoFactorRequiredError";
	constructor() {
		super(
			"Two-factor authentication is required — export the file manually and use --source",
		);
	}
}

export class WixCaptchaDetectedError extends Error {
	override name = "WixCaptchaDetectedError";
	constructor() {
		super(
			"CAPTCHA detected — the site requires human verification.\n" +
				"Export the blog CSV manually via your Wix Dashboard → Blog → Posts → Export and use --source.",
		);
	}
}

export class WixBotDetectionError extends Error {
	override name = "WixBotDetectionError";
	constructor() {
		super(
			"Bot detection triggered (Cloudflare or similar security layer).\n" +
				"Export the blog CSV manually via your Wix Dashboard → Blog → Posts → Export and use --source.",
		);
	}
}

export class WixSiteNotFoundError extends Error {
	override name = "WixSiteNotFoundError";
	constructor() {
		super(
			"Blog export is not available for this site — make sure the Wix Blog app is installed.\n" +
				"In your Wix Dashboard go to Blog → Posts and confirm posts are visible.",
		);
	}
}

// ---------------------------------------------------------------------------
// Options / Result
// ---------------------------------------------------------------------------

export type WixFetchOptions = {
	siteUrl: string;
	email: string;
	password: string;
	downloadDir: string;
	headless?: boolean;
	timeoutMs?: number;
};

export type WixFetchResult = {
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

async function attemptWixExport(
	opts: WixFetchOptions & { headless: boolean },
): Promise<WixFetchResult> {
	const {
		siteUrl: _siteUrl,
		email,
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

		// 1. Navigate to Wix signin
		await page.goto("https://users.wix.com/signin", {
			timeout: timeoutMs,
			waitUntil: "domcontentloaded",
		});

		// 2. Check for bot detection / CAPTCHA before attempting login
		const loginContent = await page.content();
		if (isBotBlocked(loginContent)) {
			throw new WixBotDetectionError();
		}
		if (
			loginContent.includes("g-recaptcha") ||
			loginContent.includes("h-captcha")
		) {
			throw new WixCaptchaDetectedError();
		}

		// 3. Fill email and submit first step
		await page.fill('[type="email"], [name="email"], #email', email);
		await page.click('[type="submit"], button[data-testid="submit"]');

		// 4. Fill password and submit second step
		await page.fill(
			'[type="password"], [name="password"], #password',
			password,
		);
		await page.click('[type="submit"], button[data-testid="submit"]');

		// 5. Check for 2FA / error — only if still on signin domain
		const postLoginUrl = page.url();
		if (
			postLoginUrl.includes("signin") ||
			!postLoginUrl.includes("manage.wix.com")
		) {
			if (postLoginUrl.includes("/signin/verification")) {
				throw new WixTwoFactorRequiredError();
			}
			const has2FA = await page
				.locator(
					'[data-testid*="verification"], [data-testid*="phone"], input[name*="code"]',
				)
				.count();
			if (has2FA > 0) {
				throw new WixTwoFactorRequiredError();
			}
			const hasError = await page
				.locator(
					'[data-testid="error-message"], .error-message, [data-testid*="error"]',
				)
				.count();
			if (hasError > 0) {
				throw new WixInvalidCredentialsError();
			}
		}

		// 6. Find blog export in dashboard
		await mkdir(downloadDir, { recursive: true });

		const hasBlogExport = await page
			.locator(
				'[data-testid*="blog"], a[href*="blog"], button:has-text("Export")',
			)
			.count();
		if (hasBlogExport === 0) {
			throw new WixSiteNotFoundError();
		}

		// 7. Trigger download
		const downloadPromise = page.waitForEvent("download", {
			timeout: timeoutMs,
		});
		await page.locator('button:has-text("Export")').first().click();

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

export async function fetchWixExport(
	opts: WixFetchOptions,
): Promise<WixFetchResult> {
	if (opts.headless === false) {
		return attemptWixExport({ ...opts, headless: false });
	}

	try {
		return await attemptWixExport({ ...opts, headless: true });
	} catch (err) {
		if (
			err instanceof WixCaptchaDetectedError ||
			err instanceof WixBotDetectionError
		) {
			process.stderr.write(
				"\n[astropress] Bot detection or CAPTCHA triggered in headless mode.\n" +
					"[astropress] Opening a visible browser — please solve any challenge that appears,\n" +
					"[astropress] then the export will continue automatically.\n\n",
			);
			return await attemptWixExport({ ...opts, headless: false });
		}
		throw err;
	}
}
