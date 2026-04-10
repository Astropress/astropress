import { afterEach, describe, expect, it } from "vitest";

import { getCmsConfig, peekCmsConfig, registerCms, type AnalyticsConfig, type AbTestingConfig, type AstropressApiConfig } from "../src/config";
import { resolveAnalyticsSnippet } from "../src/analytics.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function restoreConfig(config: ReturnType<typeof peekCmsConfig>) {
  (globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[CMS_CONFIG_KEY] = config ?? null;
}

afterEach(() => {
  restoreConfig(null);
});

describe("AnalyticsConfig types", () => {
  it("umami analytics config is correctly typed", () => {
    const config: AnalyticsConfig = {
      type: "umami",
      mode: "iframe",
      url: "https://analytics.example.com",
      siteId: "abc-123",
    };

    expect(config.type).toBe("umami");
    expect(config.mode).toBe("iframe");
    expect(config.siteId).toBe("abc-123");
  });

  it("plausible analytics config uses snippet-only mode", () => {
    const config: AnalyticsConfig = {
      type: "plausible",
      mode: "snippet-only",
      snippetSrc: "https://plausible.io/js/script.js",
      siteId: "example.com",
    };

    expect(config.mode).toBe("snippet-only");
    expect(config.snippetSrc).toBe("https://plausible.io/js/script.js");
  });

  it("all supported analytics types are valid", () => {
    const types: AnalyticsConfig["type"][] = ["umami", "plausible", "matomo", "posthog", "custom"];
    for (const type of types) {
      const config: AnalyticsConfig = { type, mode: "link" };
      expect(config.type).toBe(type);
    }
  });

  it("label is optional", () => {
    const withLabel: AnalyticsConfig = { type: "umami", mode: "link", label: "My Analytics" };
    const withoutLabel: AnalyticsConfig = { type: "umami", mode: "link" };
    expect(withLabel.label).toBe("My Analytics");
    expect(withoutLabel.label).toBeUndefined();
  });
});

describe("AbTestingConfig types", () => {
  it("growthbook ab testing config is correctly typed", () => {
    const config: AbTestingConfig = {
      type: "growthbook",
      mode: "iframe",
      url: "https://growthbook.example.com",
      apiEndpoint: "https://cdn.growthbook.io/api/features/key",
    };

    expect(config.type).toBe("growthbook");
    expect(config.mode).toBe("iframe");
    expect(config.apiEndpoint).toBeDefined();
  });

  it("unleash ab testing config uses link mode", () => {
    const config: AbTestingConfig = {
      type: "unleash",
      mode: "link",
      url: "https://unleash.example.com",
      label: "Unleash",
    };

    expect(config.mode).toBe("link");
    expect(config.label).toBe("Unleash");
  });

  it("all supported ab testing types are valid", () => {
    const types: AbTestingConfig["type"][] = ["growthbook", "unleash", "custom"];
    for (const type of types) {
      const config: AbTestingConfig = { type, mode: "link" };
      expect(config.type).toBe(type);
    }
  });
});

describe("AstropressApiConfig types", () => {
  it("api config with enabled flag", () => {
    const config: AstropressApiConfig = { enabled: true };
    expect(config.enabled).toBe(true);
    expect(config.requireHttps).toBeUndefined();
    expect(config.rateLimit).toBeUndefined();
  });

  it("api config with all options", () => {
    const config: AstropressApiConfig = {
      enabled: true,
      requireHttps: true,
      rateLimit: 120,
    };
    expect(config.requireHttps).toBe(true);
    expect(config.rateLimit).toBe(120);
  });
});

describe("registerCms with analytics, abTesting, api fields", () => {
  it("registerCms accepts analytics config", () => {
    registerCms({
      siteUrl: "https://example.com",
      templateKeys: [],
      seedPages: [],
      archives: [],
      translationStatus: [],
      analytics: {
        type: "umami",
        mode: "iframe",
        url: "https://analytics.example.com",
      },
    });

    const config = getCmsConfig();
    expect(config.analytics?.type).toBe("umami");
    expect(config.analytics?.mode).toBe("iframe");
  });

  it("registerCms accepts abTesting config", () => {
    registerCms({
      siteUrl: "https://example.com",
      templateKeys: [],
      seedPages: [],
      archives: [],
      translationStatus: [],
      abTesting: {
        type: "growthbook",
        mode: "link",
        url: "https://growthbook.example.com",
      },
    });

    const config = getCmsConfig();
    expect(config.abTesting?.type).toBe("growthbook");
  });

  it("registerCms accepts api config", () => {
    registerCms({
      siteUrl: "https://example.com",
      templateKeys: [],
      seedPages: [],
      archives: [],
      translationStatus: [],
      api: { enabled: true, rateLimit: 60 },
    });

    const config = getCmsConfig();
    expect(config.api?.enabled).toBe(true);
    expect(config.api?.rateLimit).toBe(60);
  });

  it("analytics and abTesting are optional — absent when not configured", () => {
    registerCms({
      siteUrl: "https://example.com",
      templateKeys: [],
      seedPages: [],
      archives: [],
      translationStatus: [],
    });

    const config = getCmsConfig();
    expect(config.analytics).toBeUndefined();
    expect(config.abTesting).toBeUndefined();
    expect(config.api).toBeUndefined();
  });
});

describe("resolveAnalyticsSnippet", () => {
  it("returns empty string for null/undefined config", () => {
    expect(resolveAnalyticsSnippet(null)).toBe("");
    expect(resolveAnalyticsSnippet(undefined)).toBe("");
  });

  it("umami: produces script tag with data-website-id", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "umami",
      mode: "snippet-only",
      snippetSrc: "https://analytics.example.com/script.js",
      siteId: "abc-123",
    });
    expect(snippet).toContain('<script');
    expect(snippet).toContain('data-website-id="abc-123"');
    expect(snippet).toContain('src="https://analytics.example.com/script.js"');
  });

  it("plausible: produces script tag with data-domain", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "plausible",
      mode: "snippet-only",
      snippetSrc: "https://plausible.io/js/script.js",
      siteId: "example.com",
    });
    expect(snippet).toContain('data-domain="example.com"');
    expect(snippet).toContain('src="https://plausible.io/js/script.js"');
  });

  it("matomo: produces tracker script with site ID", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "matomo",
      mode: "snippet-only",
      url: "https://matomo.example.com",
      siteId: "5",
    });
    expect(snippet).toContain("matomo.php");
    expect(snippet).toContain("'5'");
    expect(snippet).toContain("matomo.example.com");
  });

  it("posthog: produces posthog init script", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "posthog",
      mode: "snippet-only",
      snippetSrc: "https://app.posthog.com",
      siteId: "phc_testkey",
    });
    expect(snippet).toContain("posthog.init");
    expect(snippet).toContain("phc_testkey");
  });

  it("custom: passes snippet through as-is", () => {
    const custom = "<script>window.myAnalytics = true;</script>";
    const snippet = resolveAnalyticsSnippet({
      type: "custom",
      mode: "snippet-only",
      snippetSrc: custom,
    });
    expect(snippet).toBe(custom);
  });

  it("umami: returns empty string when siteId is missing", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "umami",
      mode: "snippet-only",
      snippetSrc: "https://analytics.example.com/script.js",
    });
    expect(snippet).toBe("");
  });

  it("HTML-encodes attribute values to prevent XSS (non-custom types)", () => {
    const snippet = resolveAnalyticsSnippet({
      type: "umami",
      mode: "snippet-only",
      snippetSrc: "https://example.com/script.js",
      siteId: 'abc"<>',
    });
    expect(snippet).not.toContain('"<>');
    expect(snippet).toContain("&quot;&lt;&gt;");
  });
});
