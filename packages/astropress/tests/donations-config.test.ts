import { describe, expect, it } from "vitest";
import { buildDonationsEnvExample, resolveDonationSnippets } from "../src/donations";

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

describe("env example value contracts", () => {
	it("GIVELIVELY_CAMPAIGN_SLUG carries the campaign-slug guidance string (pins L111 StringLiteral)", () => {
		const result = buildDonationsEnvExample({ giveLively: true });
		expect(result.GIVELIVELY_CAMPAIGN_SLUG).toBe("replace-with-your-campaign-slug-or-remove");
	});

	it("LIBERAPAY_USERNAME carries the username guidance string (pins L114 StringLiteral)", () => {
		const result = buildDonationsEnvExample({ liberapay: true });
		expect(result.LIBERAPAY_USERNAME).toBe("replace-with-your-liberapay-username");
	});

	it("PLEDGE_PARTNER_KEY carries the partner-key placeholder (pins L117 StringLiteral)", () => {
		const result = buildDonationsEnvExample({ pledgeCrypto: true });
		expect(result.PLEDGE_PARTNER_KEY).toBe("[YOUR_PLEDGE_PARTNER_KEY]");
	});

	it("does not emit giveLively keys when only liberapay is enabled (pins L109 ConditionalExpression)", () => {
		const result = buildDonationsEnvExample({ liberapay: true });
		expect(result).not.toHaveProperty("GIVELIVELY_ORG_SLUG");
		expect(result).not.toHaveProperty("GIVELIVELY_CAMPAIGN_SLUG");
	});

	it("does not emit liberapay key when only pledgeCrypto is enabled (pins L113 ConditionalExpression)", () => {
		const result = buildDonationsEnvExample({ pledgeCrypto: true });
		expect(result).not.toHaveProperty("LIBERAPAY_USERNAME");
	});

	it("does not emit pledgeCrypto key when only giveLively is enabled (pins L116 ConditionalExpression)", () => {
		const result = buildDonationsEnvExample({ giveLively: true });
		expect(result).not.toHaveProperty("PLEDGE_PARTNER_KEY");
	});
});

describe("env example omits donation keys when none enabled", () => {
	it("returns empty object when donations is undefined", () => {
		const result = buildDonationsEnvExample(undefined);
		expect(result).toEqual({});
	});
});

describe("survivor pins", () => {
	it("JSON-LD includes the schema.org @context URL (pins L56)", () => {
		const result = resolveDonationSnippets(
			{ liberapay: { username: "u" } },
			"https://example.com",
			false,
		);
		expect(result.jsonLd).toContain("https://schema.org");
	});

	it("escAttr escapes & to &amp; (pins L73 first replace replacement string)", () => {
		const result = resolveDonationSnippets(
			{ giveLively: { orgSlug: "a&b" } },
			"https://example.com",
			false,
		);
		expect(result.giveLively).toContain("&amp;");
		expect(result.giveLively).not.toContain('"a&b"');
	});

	it('escAttr escapes " to &quot; (pins L73 second replace)', () => {
		const result = resolveDonationSnippets(
			{ liberapay: { username: 'me"name' } },
			"https://example.com",
			false,
		);
		expect(result.liberapay).toContain("&quot;");
	});

	it("escAttr escapes < to &lt; (pins L73 third replace)", () => {
		const result = resolveDonationSnippets(
			{ liberapay: { username: "<u>" } },
			"https://example.com",
			false,
		);
		expect(result.liberapay).toContain("&lt;");
	});

	it("GiveLively snippet contains the assets.givelively.org script src + </div> (pins L79 / L82)", () => {
		const result = resolveDonationSnippets(
			{ giveLively: { orgSlug: "myorg" } },
			"https://example.com",
			false,
		);
		expect(result.giveLively).toContain("assets.givelively.org/widget/simple_fundraiser.js");
		expect(result.giveLively).toContain("</div>");
		expect(result.giveLively).toContain("\n");
	});

	it("Liberapay snippet contains the assets/widgets/donate.svg + </a> (pins L91/L92)", () => {
		const result = resolveDonationSnippets(
			{ liberapay: { username: "u" } },
			"https://example.com",
			false,
		);
		expect(result.liberapay).toContain("Donate using Liberapay");
		expect(result.liberapay).toContain("liberapay.com/assets/widgets/donate.svg");
		expect(result.liberapay).toContain("</a>");
		expect(result.liberapay).toContain("\n");
	});

	it("env example for GiveLively uses 'replace-with-your-org-slug' placeholder (pins L110)", () => {
		const result = buildDonationsEnvExample({ giveLively: true });
		expect(result.GIVELIVELY_ORG_SLUG).toBe("replace-with-your-org-slug");
	});
});
