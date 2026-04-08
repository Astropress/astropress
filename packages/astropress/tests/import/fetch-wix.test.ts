import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Playwright mock
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const page = {
    goto: vi.fn(),
    fill: vi.fn(),
    click: vi.fn(),
    waitForURL: vi.fn(),
    url: vi.fn(),
    locator: vi.fn(),
    waitForSelector: vi.fn(),
    waitForEvent: vi.fn(),
    content: vi.fn(),
    waitForNavigation: vi.fn(),
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
  fetchWixExport,
  WixInvalidCredentialsError,
  WixTwoFactorRequiredError,
  WixCaptchaDetectedError,
  WixSiteNotFoundError,
} from "../../src/import/fetch-wix.js";

const BASE_OPTS = {
  siteUrl: "https://username.wixsite.com/mysite",
  email: "user@example.com",
  password: "wixpassword",
  downloadDir: "/tmp/wix-downloads",
};

function makeLocator(count = 0) {
  return {
    count: vi.fn().mockResolvedValue(count),
    first: vi.fn().mockReturnThis(),
    click: vi.fn(),
    waitFor: vi.fn(),
    fill: vi.fn(),
  };
}

function setupBrowserChain() {
  vi.mocked(chromium.launch).mockResolvedValue(mocks.browser as never);
  mocks.browser.newContext.mockResolvedValue(mocks.context);
  mocks.context.newPage.mockResolvedValue(mocks.page);
  // Safe defaults — individual tests can override
  mocks.page.content.mockResolvedValue("<html></html>");
  mocks.page.url.mockReturnValue("https://manage.wix.com/dashboard");
  mocks.page.locator.mockImplementation(() => makeLocator(0));
  mocks.page.goto.mockResolvedValue({ status: () => 200 });
}

describe("fetchWixExport — success path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupBrowserChain();

    mocks.page.goto.mockResolvedValue({ status: () => 200 });

    // Wix login: email step, then password step
    mocks.page.content
      .mockResolvedValueOnce('<html><form><input type="email" /></form></html>') // login page
      .mockResolvedValueOnce('<html><form><input type="password" /></form></html>'); // password step

    // After login: dashboard URL
    mocks.page.url.mockReturnValue("https://manage.wix.com/dashboard");

    // No 2FA, no CAPTCHA
    mocks.page.locator.mockImplementation((sel: string) => {
      if (sel.includes("captcha") || sel.includes("phone") || sel.includes("two-factor")) {
        return makeLocator(0);
      }
      return makeLocator(1);
    });

    // Download event
    mocks.page.waitForEvent.mockResolvedValue({
      suggestedFilename: () => "Blog_Data.csv",
      saveAs: vi.fn(),
    });
  });

  it("navigates to the Wix signin page", async () => {
    await fetchWixExport(BASE_OPTS);
    expect(mocks.page.goto).toHaveBeenCalledWith(
      expect.stringContaining("wix.com/signin"),
      expect.any(Object),
    );
  });

  it("fills the email field and submits the first step", async () => {
    await fetchWixExport(BASE_OPTS);
    expect(mocks.page.fill).toHaveBeenCalledWith(
      expect.stringContaining("email"),
      "user@example.com",
    );
  });

  it("returns the path to the downloaded CSV", async () => {
    const result = await fetchWixExport(BASE_OPTS);
    expect(result.exportPath).toContain("Blog_Data.csv");
  });

  it("closes the browser on success", async () => {
    await fetchWixExport(BASE_OPTS);
    expect(mocks.browser.close).toHaveBeenCalled();
  });
});

describe("fetchWixExport — failure modes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupBrowserChain();
  });

  it("throws WixInvalidCredentialsError when login shows an error message", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.content.mockResolvedValue(
      '<html><form><div data-testid="error-message">Incorrect email or password</div></form></html>',
    );
    mocks.page.url.mockReturnValue("https://users.wix.com/signin");
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("error") ? 1 : 0),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toBeInstanceOf(WixInvalidCredentialsError);
  });

  it("WixInvalidCredentialsError has a clear message", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.content.mockResolvedValue(
      '<html><form><div data-testid="error-message">wrong</div></form></html>',
    );
    mocks.page.url.mockReturnValue("https://users.wix.com/signin");
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("error") ? 1 : 0),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toThrow(
      "Login failed: incorrect email or password",
    );
  });

  it("throws WixTwoFactorRequiredError when phone verification is shown", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.content.mockResolvedValue('<html><form><input type="email" /></form></html>');
    mocks.page.url.mockReturnValue("https://users.wix.com/signin/verification");
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("verification") || sel.includes("phone") ? 1 : 0),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toBeInstanceOf(WixTwoFactorRequiredError);
  });

  it("WixTwoFactorRequiredError message tells the user to export manually", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.url.mockReturnValue("https://users.wix.com/signin/verification");
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("verification") ? 1 : 0),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toThrow(
      "Two-factor authentication is required",
    );
  });

  it("throws WixCaptchaDetectedError when CAPTCHA is present on login page", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.content.mockResolvedValue(
      '<html><form><div class="g-recaptcha"></div><input type="email" /></form></html>',
    );
    mocks.page.url.mockReturnValue("https://users.wix.com/signin");
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("recaptcha") || sel.includes("captcha") ? 1 : 0),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toBeInstanceOf(WixCaptchaDetectedError);
  });

  it("throws WixSiteNotFoundError when blog export is not available for the site", async () => {
    mocks.page.goto.mockResolvedValue({ status: () => 200 });
    mocks.page.content.mockResolvedValue('<html><form><input type="email" /></form></html>');
    mocks.page.url.mockReturnValue("https://manage.wix.com/dashboard");
    // After login: blog section not found
    mocks.page.locator.mockImplementation((sel: string) =>
      makeLocator(sel.includes("blog") || sel.includes("export") ? 0 : 1),
    );

    await expect(fetchWixExport(BASE_OPTS)).rejects.toBeInstanceOf(WixSiteNotFoundError);
  });

  it("always closes the browser even when an error is thrown", async () => {
    mocks.page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));
    await expect(fetchWixExport(BASE_OPTS)).rejects.toThrow();
    expect(mocks.browser.close).toHaveBeenCalled();
  });
});
