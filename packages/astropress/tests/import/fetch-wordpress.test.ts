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
  fetchWordPressExport,
  SiteNotReachableError,
  NotWordPressSiteError,
  InvalidCredentialsError,
  TwoFactorRequiredError,
  CaptchaDetectedError,
  InsufficientPermissionsError,
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

  it("returns the path to the downloaded export file", async () => {
    const result = await fetchWordPressExport(BASE_OPTS);
    expect(result.exportPath).toContain("wordpress-export.xml");
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
    mocks.page.content.mockResolvedValue('<form id="loginform"><div id="login_error">wrong</div></form>');
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
      .mockReturnValueOnce("https://mysite.com/wp-admin/")   // after login
      .mockReturnValueOnce("https://mysite.com/wp-login.php"); // after navigating to export
    mocks.page.locator.mockReturnValue(makeLocator({ count: 0 }));

    await expect(fetchWordPressExport(BASE_OPTS)).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it("always closes the browser even when an error is thrown", async () => {
    mocks.page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));
    await expect(fetchWordPressExport(BASE_OPTS)).rejects.toThrow();
    expect(mocks.browser.close).toHaveBeenCalled();
  });
});
