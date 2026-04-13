import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { isProductionRuntime } from "../src/runtime-env.js";

vi.mock("../src/runtime-env.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/runtime-env.js")>();
  return {
    ...original,
    isProductionRuntime: vi.fn().mockReturnValue(false),
  };
});

import {
  sendContactNotification,
  sendPasswordResetEmail,
  sendUserInviteEmail,
} from "../src/transactional-email.js";

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
  vi.mocked(isProductionRuntime).mockReturnValue(false);
});

afterEach(() => {
  clearCmsConfig();
  vi.unstubAllEnvs();
});

describe("sendPasswordResetEmail", () => {
  it("returns a preview in mock mode with correct subject and reset URL in html", async () => {
    setCmsConfig("My Site");
    const result = await sendPasswordResetEmail("user@example.com", "https://example.com/ap-admin/reset-password?token=abc123");
    expect(result.ok).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.preview).toBeDefined();
    expect(result.preview!.subject).toContain("My Site");
    expect(result.preview!.html).toContain("https://example.com/ap-admin/reset-password?token=abc123");
    expect(result.preview!.html).toContain("<a href=");
  });

  it("uses 'Astropress' as siteName fallback when no CMS config is registered", async () => {
    const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
    expect(result.preview!.subject).toContain("Astropress");
  });

  it("escapes HTML special chars in siteName to prevent XSS", async () => {
    setCmsConfig("<script>alert(1)</script>");
    const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
    expect(result.preview!.html).not.toContain("<script>");
    expect(result.preview!.html).toContain("&lt;script&gt;");
  });
});

describe("sendUserInviteEmail", () => {
  it("returns a preview in mock mode with invite URL in subject and html", async () => {
    setCmsConfig("Acme Corp");
    const result = await sendUserInviteEmail("invited@example.com", "https://example.com/ap-admin/accept-invite?token=xyz");
    expect(result.ok).toBe(true);
    expect(result.preview!.subject).toContain("Acme Corp");
    expect(result.preview!.html).toContain("https://example.com/ap-admin/accept-invite?token=xyz");
  });

  it("escapes HTML special chars in siteName", async () => {
    setCmsConfig('Acme & "Co"');
    const result = await sendUserInviteEmail("invited@example.com", "https://example.com/invite");
    expect(result.preview!.html).not.toContain('"Co"');
    expect(result.preview!.html).toContain("&amp;");
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
    expect(result.preview!.html).toContain("Alice");
    expect(result.preview!.html).toContain("Hello there");
  });

  it("escapes HTML in contact name to prevent XSS", async () => {
    const result = await sendContactNotification({
      name: "<img onerror=alert(1) src=x>",
      email: "x@example.com",
      message: "test",
      submittedAt: "2026-04-12T10:00:00Z",
    });
    // The tag should be HTML-escaped, so no real <img> element can execute
    expect(result.preview!.html).not.toContain("<img");
    expect(result.preview!.html).toContain("&lt;img");
  });

  it("escapes HTML in contact message body", async () => {
    const result = await sendContactNotification({
      name: "Bob",
      email: "bob@example.com",
      message: "<script>steal(document.cookie)</script>",
      submittedAt: "2026-04-12T10:00:00Z",
    });
    expect(result.preview!.html).not.toContain("<script>");
    expect(result.preview!.html).toContain("&lt;script&gt;");
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

describe("mock mode behavior", () => {
  it("returns a preview object (not sending) when EMAIL_DELIVERY_MODE is not 'resend'", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "mock");
    const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
    expect(result.ok).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.preview).toBeDefined();
    expect(result.preview!.to).toBe("user@example.com");
  });

  it("returns a preview object when SMTP mode is selected without SMTP config", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
    const result = await sendPasswordResetEmail("user@example.com", "https://example.com/reset");
    expect(result.ok).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.preview).toBeDefined();
  });
});
