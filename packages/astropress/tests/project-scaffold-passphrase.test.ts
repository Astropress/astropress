import { describe, expect, it } from "vitest";

import {
	createLocalBootstrapSecrets,
	EFF_SHORT_WORDLIST,
	generatePassphrase,
	PASSPHRASE_CHARS,
	randomSecret,
} from "../src/project-scaffold-passphrase.js";

describe("PASSPHRASE_CHARS", () => {
	it("is the documented digit + symbol alphabet", () => {
		expect(PASSPHRASE_CHARS).toBe("0123456789!@#$%^&*+");
	});
	it("has 19 characters (10 digits + 9 symbols)", () => {
		expect(PASSPHRASE_CHARS.length).toBe(19);
	});
});

describe("EFF_SHORT_WORDLIST re-export", () => {
	it("is a non-empty array of strings (re-exported from wordlist module)", () => {
		expect(Array.isArray(EFF_SHORT_WORDLIST)).toBe(true);
		expect(EFF_SHORT_WORDLIST.length).toBeGreaterThan(0);
		expect(typeof EFF_SHORT_WORDLIST[0]).toBe("string");
	});
});

describe("randomSecret", () => {
	it("returns a base64url-encoded string of the default length", () => {
		const secret = randomSecret();
		expect(typeof secret).toBe("string");
		// 24 bytes -> 32 base64url chars (no padding).
		expect(secret).toHaveLength(32);
		expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
	});
	it("respects the `bytes` argument (8 bytes -> 11 base64url chars)", () => {
		const secret = randomSecret(8);
		expect(secret).toHaveLength(11);
	});
	it("respects the `bytes` argument (32 bytes -> 43 base64url chars)", () => {
		expect(randomSecret(32)).toHaveLength(43);
	});
	it("returns a different value across calls (entropy from getRandomValues)", () => {
		const a = randomSecret();
		const b = randomSecret();
		expect(a).not.toBe(b);
	});
	it("does NOT use base64 padding (=) — uses base64url", () => {
		expect(randomSecret(8)).not.toContain("=");
	});
});

describe("generatePassphrase", () => {
	it("returns a 4-segment hyphen-delimited string", () => {
		const phrase = generatePassphrase();
		const segments = phrase.split("-");
		expect(segments).toHaveLength(4);
	});
	it("each segment ends with a PASSPHRASE_CHARS character", () => {
		const phrase = generatePassphrase();
		for (const segment of phrase.split("-")) {
			const last = segment.at(-1) as string;
			expect(PASSPHRASE_CHARS).toContain(last);
		}
	});
	it("each segment's leading word comes from EFF_SHORT_WORDLIST", () => {
		const wordSet = new Set(EFF_SHORT_WORDLIST);
		for (const segment of generatePassphrase().split("-")) {
			const word = segment.slice(0, -1);
			expect(wordSet.has(word)).toBe(true);
		}
	});
	it("returns different passphrases across calls (random)", () => {
		expect(generatePassphrase()).not.toBe(generatePassphrase());
	});
});

describe("createLocalBootstrapSecrets", () => {
	it("returns an object with the three documented keys", () => {
		const secrets = createLocalBootstrapSecrets();
		expect(Object.keys(secrets).sort()).toEqual([
			"ADMIN_PASSWORD",
			"EDITOR_PASSWORD",
			"SESSION_SECRET",
		]);
	});
	it("ADMIN_PASSWORD and EDITOR_PASSWORD are 4-segment passphrases", () => {
		const { ADMIN_PASSWORD, EDITOR_PASSWORD } = createLocalBootstrapSecrets();
		expect(ADMIN_PASSWORD.split("-")).toHaveLength(4);
		expect(EDITOR_PASSWORD.split("-")).toHaveLength(4);
	});
	it("ADMIN_PASSWORD and EDITOR_PASSWORD differ (independently generated)", () => {
		const { ADMIN_PASSWORD, EDITOR_PASSWORD } = createLocalBootstrapSecrets();
		expect(ADMIN_PASSWORD).not.toBe(EDITOR_PASSWORD);
	});
	it("SESSION_SECRET is a 43-character base64url string (32 bytes)", () => {
		const { SESSION_SECRET } = createLocalBootstrapSecrets();
		expect(SESSION_SECRET).toHaveLength(43);
		expect(SESSION_SECRET).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});
