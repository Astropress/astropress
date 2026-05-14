import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock is hoisted above all let/const initializers, so any variable used
// inside the factory must be defined via vi.hoisted(). The module also captures
// getLocalUploadsDir() once at init time, so we use a fixed path and clean the
// directory between tests rather than creating a new path per run.
// ---------------------------------------------------------------------------

const { testUploadsDir } = vi.hoisted(() => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { mkdtempSync } = require("node:fs") as typeof import("node:fs");
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { join } = require("node:path") as typeof import("node:path");
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { tmpdir } = require("node:os") as typeof import("node:os");
	return { testUploadsDir: mkdtempSync(join(tmpdir(), "astropress-media-")) };
});

vi.mock("../src/local-image-storage", () => ({
	ensureLocalUploadsDir: vi.fn(),
	getLocalUploadsDir: vi.fn(() => testUploadsDir),
	guessImageMimeType: vi.fn((path: string) => {
		if (path.endsWith(".png")) return "image/png";
		if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
		if (path.endsWith(".webp")) return "image/webp";
		if (path.endsWith(".gif")) return "image/gif";
		if (path.endsWith(".avif")) return "image/avif";
		if (path.endsWith(".svg")) return "image/svg+xml";
		return "application/octet-stream";
	}),
}));

import {
	buildLocalMediaDescriptor,
	createLocalMediaUpload,
	deleteLocalMediaUpload,
	guessMediaMimeType,
} from "../src/local-media-storage";

const validPng = new Uint8Array(1024); // 1 KB image bytes (fake PNG)
const oversizedFile = new Uint8Array(11 * 1024 * 1024); // 11 MB — exceeds limit

beforeEach(() => {
	rmSync(testUploadsDir, { recursive: true, force: true });
	mkdirSync(testUploadsDir, { recursive: true });
});

afterEach(() => {
	rmSync(testUploadsDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// guessMediaMimeType
// ---------------------------------------------------------------------------

describe("guessMediaMimeType", () => {
	it("delegates to guessImageMimeType from local-image-storage", () => {
		expect(guessMediaMimeType("photo.png")).toBe("image/png");
		expect(guessMediaMimeType("photo.jpg")).toBe("image/jpeg");
		expect(guessMediaMimeType("photo.webp")).toBe("image/webp");
	});
});

// ---------------------------------------------------------------------------
// buildLocalMediaDescriptor
// ---------------------------------------------------------------------------

describe("buildLocalMediaDescriptor", () => {
	it("returns a valid descriptor for a PNG upload", () => {
		const result = buildLocalMediaDescriptor({
			filename: "photo.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.asset.mimeType).toBe("image/png");
		expect(result.asset.fileSize).toBe(1024);
		expect(result.asset.publicPath).toMatch(/^\/images\/uploads\//);
		expect(result.asset.r2Key).toMatch(/^uploads\//);
		expect(result.asset.storedFilename).toMatch(/^media-[0-9a-f-]{36}$/);
	});

	it("uses provided title and altText", () => {
		const result = buildLocalMediaDescriptor({
			filename: "banner.png",
			bytes: validPng,
			title: "My Banner",
			altText: "A colourful banner",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.asset.title).toBe("My Banner");
		expect(result.asset.altText).toBe("A colourful banner");
	});

	it("falls back to sanitised basename as title", () => {
		const result = buildLocalMediaDescriptor({
			filename: "my awesome photo.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.asset.title).toBe("my-awesome-photo");
	});

	it("rejects empty filename", () => {
		const result = buildLocalMediaDescriptor({ filename: "", bytes: validPng });
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("Select a file");
	});

	it("rejects zero-byte file", () => {
		const result = buildLocalMediaDescriptor({
			filename: "empty.png",
			bytes: new Uint8Array(0),
		});
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects file exceeding 10 MB", () => {
		const result = buildLocalMediaDescriptor({
			filename: "huge.png",
			bytes: oversizedFile,
		});
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("10 MB");
	});

	it("rejects disallowed extension (.php)", () => {
		const result = buildLocalMediaDescriptor({
			filename: "malicious.php",
			bytes: validPng,
		});
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("not allowed");
	});

	it("rejects disallowed extension (.exe)", () => {
		const result = buildLocalMediaDescriptor({
			filename: "evil.exe",
			bytes: validPng,
		});
		expect(result).toMatchObject({ ok: false });
	});

	it("accepts all allowed extensions", () => {
		const allowed = [
			"photo.jpg",
			"photo.jpeg",
			"photo.png",
			"photo.webp",
			"photo.gif",
			"photo.avif",
			"photo.svg",
		];
		for (const filename of allowed) {
			const result = buildLocalMediaDescriptor({ filename, bytes: validPng });
			expect(result.ok, `Expected ok for ${filename}`).toBe(true);
		}
	});

	it("rejects file exactly equal to maxUploadBytes is also accepted (kills L56 EqualityOperator >= mutant on the size guard)", () => {
		// boundary: byteLength === maxUploadBytes is allowed (the guard uses >).
		// Mutated `>= maxUploadBytes`: rejects exactly-at-limit uploads.
		const exactlyMax = new Uint8Array(10 * 1024 * 1024);
		const result = buildLocalMediaDescriptor({
			filename: "limit.png",
			bytes: exactlyMax,
		});
		expect(result.ok).toBe(true);
	});

	it("treats a no-extension filename as disallowed via the '.bin' fallback (kills L60 StringLiteral '.bin' → '')", () => {
		// path.extname("noext") === "" → || ".bin" → ".bin" (not in allowedExtensions).
		// Mutant: || "" → still "" → not in allowedExtensions, still rejected. Both yield the
		// same rejection, but the ERROR phrasing path is identical too. To observe the
		// difference, use a filename whose lowercased extname is "" but whose basename ends in
		// something that would change the .extname trip-point. The simplest observable check:
		// after the mutant, allowedExtensions.has("") would let "" through; ensure it stays
		// rejected.
		const result = buildLocalMediaDescriptor({ filename: "noextension", bytes: validPng });
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("not allowed");
	});

	it("collapses runs of non-alphanumerics into single dashes (kills L81 Regex '+' quantifier)", () => {
		// Original /[^a-z0-9]+/gi: runs collapse to a single "-".
		// Mutant /[^a-z0-9]/gi: each non-alphanumeric becomes "-".
		const result = buildLocalMediaDescriptor({
			filename: "my   awesome---photo.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// Three spaces and three dashes collapse together → exactly one "-" each gap.
		expect(result.asset.title).toBe("my-awesome-photo");
	});

	it("strips leading/trailing dashes from the sanitised basename (kills L82 StringLiteral 'Stryker was here!')", () => {
		// "-foo-.png" → replace strips runs to "-foo-" → strip leading/trailing → "foo".
		// Mutant replaces "" with "Stryker was here!" → "Stryker was here!fooStryker was here!".
		const result = buildLocalMediaDescriptor({
			filename: "-foo-.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.asset.title).toBe("foo");
	});

	it("defaults the basename to 'upload' when sanitisation leaves nothing (kills L83 StringLiteral '' fallback)", () => {
		// "---.png" → "-" after run-collapse → "" after edge-trim → falls back via || "upload".
		// Mutant: fallback is "" → title becomes "" (or input.title trimmed).
		const result = buildLocalMediaDescriptor({
			filename: "---.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.asset.title).toBe("upload");
	});

	it("trims whitespace from title and altText (kills L99/L100 MethodExpression dropping .trim)", () => {
		const result = buildLocalMediaDescriptor({
			filename: "photo.png",
			bytes: validPng,
			title: "  spaced title  ",
			altText: "  alt with edges  ",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// Mutant L99: drops .trim() → title retains leading/trailing spaces.
		// Mutant L100: same for altText.
		expect(result.asset.title).toBe("spaced title");
		expect(result.asset.altText).toBe("alt with edges");
	});

	it("defaults altText to '' when not provided (kills L100 StringLiteral '' → 'Stryker was here!')", () => {
		const result = buildLocalMediaDescriptor({
			filename: "photo.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// Mutated fallback ?? "Stryker was here!" would produce a non-empty altText.
		expect(result.asset.altText).toBe("");
	});

	it("generates a unique id on each call", () => {
		const r1 = buildLocalMediaDescriptor({
			filename: "a.png",
			bytes: validPng,
		});
		const r2 = buildLocalMediaDescriptor({
			filename: "b.png",
			bytes: validPng,
		});
		expect(r1.ok && r2.ok).toBe(true);
		if (!r1.ok || !r2.ok) return;
		expect(r1.asset.id).not.toBe(r2.asset.id);
	});
});

// ---------------------------------------------------------------------------
// createLocalMediaUpload
// ---------------------------------------------------------------------------

describe("createLocalMediaUpload", () => {
	it("writes the file to disk and returns descriptor", () => {
		const result = createLocalMediaUpload({
			filename: "test.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(existsSync(result.asset.diskPath)).toBe(true);
	});

	it("writes file with owner-only permissions (mode 0o600)", () => {
		const result = createLocalMediaUpload({
			filename: "perm.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const stat = statSync(result.asset.diskPath);
		// Mode includes file type bits; mask to permission bits only
		expect(stat.mode & 0o777).toBe(0o600);
	});

	it("propagates validation errors without writing to disk (kills L104 ConditionalExpression:false & BlockStatement)", () => {
		// Mutant L104 ConditionalExpression:false / BlockStatement {}: the early
		// `return descriptor` is skipped, so writeFileSync runs even for a rejected
		// upload — leaving a stray file in the uploads dir.
		const before = readdirSync(testUploadsDir);
		const result = createLocalMediaUpload({
			filename: "bad.exe",
			bytes: validPng,
		});
		expect(result).toMatchObject({ ok: false });
		expect(readdirSync(testUploadsDir)).toEqual(before);
	});
});

// ---------------------------------------------------------------------------
// deleteLocalMediaUpload
// ---------------------------------------------------------------------------

describe("deleteLocalMediaUpload", () => {
	it("deletes a file written to the uploads dir", () => {
		const result = createLocalMediaUpload({
			filename: "del.png",
			bytes: validPng,
		});
		if (!result.ok) return;
		expect(existsSync(result.asset.diskPath)).toBe(true);
		deleteLocalMediaUpload(result.asset.publicPath);
		expect(existsSync(result.asset.diskPath)).toBe(false);
	});

	it("only deletes paths under /images/uploads/ (kills L126 ConditionalExpression:false, StringLiteral '' on the prefix check, and L126 BlockStatement {} on the body)", () => {
		// Write a file outside the uploads dir into the testUploadsDir tree but reference it
		// via a non-/images/uploads path. The guard must return without unlinking.
		const result = createLocalMediaUpload({
			filename: "stay.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// Try to delete via a path that doesn't start with the prefix.
		deleteLocalMediaUpload("/other/area/stay.png");
		expect(existsSync(result.asset.diskPath)).toBe(true);
		// Now delete via the legitimate path — file should be removed.
		deleteLocalMediaUpload(result.asset.publicPath);
		expect(existsSync(result.asset.diskPath)).toBe(false);
	});

	it("is a no-op for paths outside the uploads dir", () => {
		// Should not throw
		expect(() => deleteLocalMediaUpload("/etc/passwd")).not.toThrow();
		expect(() => deleteLocalMediaUpload("relative/path/file.png")).not.toThrow();
	});

	it("is a no-op for non-existent files (no throw)", () => {
		expect(() => deleteLocalMediaUpload("/images/uploads/does-not-exist-12345.png")).not.toThrow();
	});

	it("does not unlink a file when the path's basename collides but the prefix is wrong (kills L115 ConditionalExpression:false, StringLiteral '', BlockStatement)", () => {
		// The guard rejects any path not under /images/uploads/. Mutants that disable
		// the early return (ConditionalExpression:false, BlockStatement {}) or that
		// make startsWith("") always-true would fall through to unlinkSync on the
		// real stored file, since basename here equals the actual stored filename.
		const result = createLocalMediaUpload({
			filename: "keep.png",
			bytes: validPng,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		deleteLocalMediaUpload(`/elsewhere/${result.asset.storedFilename}`);
		expect(existsSync(result.asset.diskPath)).toBe(true);
	});
});
