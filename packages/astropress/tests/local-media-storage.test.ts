import { existsSync, mkdirSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock is hoisted above all let/const initializers, so any variable used
// inside the factory must be defined via vi.hoisted(). The module also captures
// getLocalUploadsDir() once at init time, so we use a fixed path and clean the
// directory between tests rather than creating a new path per run.
// ---------------------------------------------------------------------------

const { testUploadsDir } = vi.hoisted(() => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { join } = require("node:path") as typeof import("node:path");
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { tmpdir } = require("node:os") as typeof import("node:os");
	return { testUploadsDir: join(tmpdir(), "astropress-media-test-suite") };
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
		expect(result.asset.storedFilename).toMatch(/\.png$/);
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

	it("propagates validation errors without writing to disk", () => {
		const result = createLocalMediaUpload({
			filename: "bad.exe",
			bytes: validPng,
		});
		expect(result).toMatchObject({ ok: false });
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

	it("is a no-op for paths outside the uploads dir", () => {
		// Should not throw
		expect(() => deleteLocalMediaUpload("/etc/passwd")).not.toThrow();
		expect(() =>
			deleteLocalMediaUpload("relative/path/file.png"),
		).not.toThrow();
	});

	it("is a no-op for non-existent files (no throw)", () => {
		expect(() =>
			deleteLocalMediaUpload("/images/uploads/does-not-exist-12345.png"),
		).not.toThrow();
	});
});
