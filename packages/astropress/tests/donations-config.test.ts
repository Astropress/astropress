import { describe, it, expect } from "vitest";
import { resolveDonationSnippets, buildDonationsEnvExample } from "../src/donations";

// ── no donations configured ────────────────────────────────────────────────

describe("no donations configured returns empty snippets", () => {
  it("returns all empty strings when donations is undefined", () => {
    const result = resolveDonationSnippets(undefined, "https://example.com", false);
    expect(result.giveLively).toBe("");
    expect(result.liberapay).toBe("");
    expect(result.pledgeCrypto).toBe("");
    expect(result.pledgeCryptoHeadScript).toBe("");
    expect(result.jsonLd).toBe("");
  });
});

// ── GiveLively ────────────────────────────────────────────────────────────────

describe("GiveLively config generates widget HTML", () => {
  it("includes give-lively-widget and org identifier", () => {
    const result = resolveDonationSnippets(
      { giveLively: { orgSlug: "my-org" } },
      "https://example.com",
      false,
    );
    expect(result.giveLively).toContain("give-lively-widget");
    expect(result.giveLively).toContain("my-org/my-org");
  });
});

describe("GiveLively with campaign slug uses campaign identifier", () => {
  it("formats identifier as orgSlug/campaignSlug", () => {
    const result = resolveDonationSnippets(
      { giveLively: { orgSlug: "my-org", campaignSlug: "my-campaign" } },
      "https://example.com",
      false,
    );
    expect(result.giveLively).toContain("my-org/my-campaign");
  });
});

describe("GiveLively without campaign slug falls back to org slug", () => {
  it("formats identifier as orgSlug/orgSlug when campaignSlug is omitted", () => {
    const result = resolveDonationSnippets(
      { giveLively: { orgSlug: "my-org" } },
      "https://example.com",
      false,
    );
    expect(result.giveLively).toContain("my-org/my-org");
  });
});

// ── Liberapay ────────────────────────────────────────────────────────────────

describe("Liberapay config generates button HTML", () => {
  it("includes liberapay donate URL with username", () => {
    const result = resolveDonationSnippets(
      { liberapay: { username: "myuser" } },
      "https://example.com",
      false,
    );
    expect(result.liberapay).toContain("liberapay.com/myuser/donate");
  });
});

// ── PledgeCrypto ──────────────────────────────────────────────────────────────

describe("PledgeCrypto config generates widget HTML", () => {
  it("includes plg-donate div with partner key", () => {
    const result = resolveDonationSnippets(
      { pledgeCrypto: { partnerKey: "pk_test_123" } },
      "https://example.com",
      false,
    );
    expect(result.pledgeCrypto).toContain("plg-donate");
    expect(result.pledgeCrypto).toContain("pk_test_123");
  });
});

describe("PledgeCrypto generates head script tag", () => {
  it("includes pledge-widget.js script src", () => {
    const result = resolveDonationSnippets(
      { pledgeCrypto: { partnerKey: "pk_test_123" } },
      "https://example.com",
      false,
    );
    expect(result.pledgeCryptoHeadScript).toContain("pledge-widget.js");
  });
});

// ── DNT / GPC suppression ─────────────────────────────────────────────────────

describe("GiveLively suppressed when DNT opted out", () => {
  it("returns empty string for giveLively when optedOut is true", () => {
    const result = resolveDonationSnippets(
      { giveLively: { orgSlug: "my-org" } },
      "https://example.com",
      true,
    );
    expect(result.giveLively).toBe("");
  });
});

describe("PledgeCrypto suppressed when DNT opted out", () => {
  it("returns empty string for pledgeCrypto and head script when optedOut is true", () => {
    const result = resolveDonationSnippets(
      { pledgeCrypto: { partnerKey: "pk_test_123" } },
      "https://example.com",
      true,
    );
    expect(result.pledgeCrypto).toBe("");
    expect(result.pledgeCryptoHeadScript).toBe("");
  });
});

describe("Liberapay not suppressed when DNT opted out", () => {
  it("still returns liberapay snippet when optedOut is true", () => {
    const result = resolveDonationSnippets(
      { liberapay: { username: "myuser" } },
      "https://example.com",
      true,
    );
    expect(result.liberapay).toContain("liberapay.com/myuser/donate");
  });
});

// ── multiple providers ────────────────────────────────────────────────────────

describe("multiple providers can be enabled simultaneously", () => {
  it("all three providers produce non-empty snippets", () => {
    const result = resolveDonationSnippets(
      {
        giveLively: { orgSlug: "my-org" },
        liberapay: { username: "myuser" },
        pledgeCrypto: { partnerKey: "pk_test_123" },
      },
      "https://example.com",
      false,
    );
    expect(result.giveLively).not.toBe("");
    expect(result.liberapay).not.toBe("");
    expect(result.pledgeCrypto).not.toBe("");
  });
});

// ── JSON-LD ───────────────────────────────────────────────────────────────────

describe("JSON-LD DonateAction included when any provider enabled", () => {
  it("includes DonateAction type and donate URL", () => {
    const result = resolveDonationSnippets(
      { liberapay: { username: "myuser" } },
      "https://example.com",
      false,
    );
    expect(result.jsonLd).toContain("DonateAction");
    expect(result.jsonLd).toContain("https://example.com/donate");
  });
});

describe("JSON-LD omitted when no providers configured", () => {
  it("returns empty string for jsonLd when donations is undefined", () => {
    const result = resolveDonationSnippets(undefined, "https://example.com", false);
    expect(result.jsonLd).toBe("");
  });
});

// ── env example ──────────────────────────────────────────────────────────────

describe("env example includes GiveLively keys when enabled", () => {
  it("contains GIVELIVELY_ORG_SLUG", () => {
    const result = buildDonationsEnvExample({ giveLively: true });
    expect(Object.keys(result)).toContain("GIVELIVELY_ORG_SLUG");
  });
});

describe("env example includes Liberapay key when enabled", () => {
  it("contains LIBERAPAY_USERNAME", () => {
    const result = buildDonationsEnvExample({ liberapay: true });
    expect(Object.keys(result)).toContain("LIBERAPAY_USERNAME");
  });
});

describe("env example includes PledgeCrypto key when enabled", () => {
  it("contains PLEDGE_PARTNER_KEY", () => {
    const result = buildDonationsEnvExample({ pledgeCrypto: true });
    expect(Object.keys(result)).toContain("PLEDGE_PARTNER_KEY");
  });
});

describe("env example omits donation keys when none enabled", () => {
  it("returns empty object when donations is undefined", () => {
    const result = buildDonationsEnvExample(undefined);
    expect(result).toEqual({});
  });
});
