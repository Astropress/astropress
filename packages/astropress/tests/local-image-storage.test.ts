import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ensureLocalUploadsDir,
	generateSrcset,
	getLocalImageRoot,
	getLocalUploadsDir,
	guessImageMimeType,
	readLocalImageAsset,
	resolveLocalImageDiskPath,
} from "../src/local-image-storage";

const ENV_KEYS = ["ASTROPRESS_LOCAL_IMAGE_ROOT", "LOCAL_IMAGE_ROOT"] as const;

let workspaces: string[] = [];
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
	for (const k of ENV_KEYS) {
		if (values[k] === undefined) delete process.env[k];
		else process.env[k] = values[k];
	}
}

beforeEach(() => {
	setEnv({});
});
afterEach(() => {
	setEnv({});
	for (const w of workspaces) {
		try {
			rmSync(w, { recursive: true, force: true });
		} catch {}
	}
	workspaces = [];
	vi.restoreAllMocks();
});

describe("getLocalImageRoot", () => {
	it("uses ASTROPRESS_LOCAL_IMAGE_ROOT when set", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "/tmp/custom-root" });
		expect(getLocalImageRoot()).toBe("/tmp/custom-root");
	});

	it("falls back to LOCAL_IMAGE_ROOT when ASTROPRESS_* unset", () => {
		setEnv({ LOCAL_IMAGE_ROOT: "/tmp/legacy-root" });
		expect(getLocalImageRoot()).toBe("/tmp/legacy-root");
	});

	it("prefers ASTROPRESS_* over LOCAL_IMAGE_ROOT when both set", () => {
		setEnv({
			ASTROPRESS_LOCAL_IMAGE_ROOT: "/tmp/preferred",
			LOCAL_IMAGE_ROOT: "/tmp/fallback",
		});
		expect(getLocalImageRoot()).toBe("/tmp/preferred");
	});

	it("trims surrounding whitespace from the env value", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "  /tmp/trimmed  " });
		expect(getLocalImageRoot()).toBe("/tmp/trimmed");
	});

	it("falls through to default when env value is empty/whitespace only", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "   " });
		const root = getLocalImageRoot();
		expect(root).toContain("astropress");
		expect(root).toContain("local-images");
	});

	it("returns a tmpdir-rooted default when no env is set", () => {
		const root = getLocalImageRoot();
		expect(root.startsWith(tmpdir())).toBe(true);
	});

	it("default path includes both 'astropress' and 'local-images' segments", () => {
		// Pins the StringLiteral mutations on the join() segments.
		const root = getLocalImageRoot();
		expect(root.split("/")).toContain("astropress");
		expect(root.split("/")).toContain("local-images");
	});

	it("trims whitespace from LOCAL_IMAGE_ROOT (legacy env)", () => {
		// Pins MethodExpression `LOCAL_IMAGE_ROOT?.trim()` -> `LOCAL_IMAGE_ROOT`.
		setEnv({ LOCAL_IMAGE_ROOT: "  /tmp/legacy-trimmed  " });
		expect(getLocalImageRoot()).toBe("/tmp/legacy-trimmed");
	});
});

describe("getLocalUploadsDir", () => {
	it("appends '/uploads' to the resolved image root", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "/tmp/root" });
		expect(getLocalUploadsDir()).toBe(join("/tmp/root", "uploads"));
	});
});

describe("ensureLocalUploadsDir", () => {
	it("creates the uploads directory recursively", () => {
		const w = mkdtempSync(join(tmpdir(), "astropress-img-"));
		workspaces.push(w);
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: w });
		const target = join(w, "uploads");
		expect(existsSync(target)).toBe(false);
		ensureLocalUploadsDir();
		expect(existsSync(target)).toBe(true);
		// Calling again on an existing dir must not throw.
		expect(() => ensureLocalUploadsDir()).not.toThrow();
	});
});

describe("guessImageMimeType", () => {
	it.each([
		[".svg", "image/svg+xml"],
		[".png", "image/png"],
		[".webp", "image/webp"],
		[".gif", "image/gif"],
		[".avif", "image/avif"],
	])("returns %s correctly", (ext, mime) => {
		expect(guessImageMimeType(`x${ext}`)).toBe(mime);
		expect(guessImageMimeType(`x${ext.toUpperCase()}`)).toBe(mime);
	});

	it("falls back to image/jpeg for unknown extensions", () => {
		expect(guessImageMimeType("x.jpg")).toBe("image/jpeg");
		expect(guessImageMimeType("x.jpeg")).toBe("image/jpeg");
		expect(guessImageMimeType("x.bin")).toBe("image/jpeg");
		expect(guessImageMimeType("x")).toBe("image/jpeg");
	});

	it("matches case-insensitively across the path (not just the extension)", () => {
		expect(guessImageMimeType("/PATH/x.PnG")).toBe("image/png");
	});
});

describe("resolveLocalImageDiskPath", () => {
	it("strips the /images/ prefix and joins to the image root", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "/tmp/root" });
		expect(resolveLocalImageDiskPath("/images/uploads/a.png")).toBe(
			join("/tmp/root", "uploads", "a.png"),
		);
	});

	it("throws when path does not start with /images/", () => {
		expect(() => resolveLocalImageDiskPath("/uploads/a.png")).toThrow(
			/Expected image path under \/images\//,
		);
		expect(() => resolveLocalImageDiskPath("images/a.png")).toThrow();
		expect(() => resolveLocalImageDiskPath("")).toThrow();
	});
});

describe("readLocalImageAsset", () => {
	it("returns ok:false when the file does not exist", () => {
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: "/tmp/does-not-exist-xyz" });
		const r = readLocalImageAsset("/images/missing.png");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toBe("Image not found.");
	});

	it("returns ok:true with mime + ArrayBuffer for an existing file", () => {
		const w = mkdtempSync(join(tmpdir(), "astropress-img-"));
		workspaces.push(w);
		mkdirSync(join(w, "uploads"), { recursive: true });
		const filename = "test.png";
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		writeFileSync(join(w, "uploads", filename), bytes);
		setEnv({ ASTROPRESS_LOCAL_IMAGE_ROOT: w });
		const r = readLocalImageAsset(`/images/uploads/${filename}`);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.asset.diskPath).toBe(join(w, "uploads", filename));
			expect(r.asset.mimeType).toBe("image/png");
			expect(r.asset.bytes.byteLength).toBe(bytes.byteLength);
			expect(new Uint8Array(r.asset.bytes)).toEqual(new Uint8Array(bytes));
		}
	});
});

describe("generateSrcset", () => {
	it("returns null when sharp throws (e.g. unavailable)", async () => {
		vi.doMock("sharp", () => ({
			default: () => {
				throw new Error("no sharp here");
			},
		}));
		const out = await generateSrcset(
			new Uint8Array([1, 2, 3]),
			"/images/uploads/x.png",
			async (_n, _b) => "/images/x-400w.webp",
		);
		expect(out).toBeNull();
		vi.doUnmock("sharp");
	});

	it("emits one variant per width with `${path} ${w}w` syntax", async () => {
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([9, 9, 9]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		const out = await generateSrcset(
			new Uint8Array([1, 2, 3]),
			"/images/uploads/photo.jpg",
			async (filename, _b) => {
				stored.push(filename);
				return `/images/${filename}`;
			},
		);
		expect(stored).toEqual([
			"photo-400w.webp",
			"photo-800w.webp",
			"photo-1200w.webp",
		]);
		expect(out).toBe(
			"/images/photo-400w.webp 400w, /images/photo-800w.webp 800w, /images/photo-1200w.webp 1200w",
		);
		vi.doUnmock("sharp");
	});

	it("returns null when storeVariant returns null for every variant", async () => {
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const out = await generateSrcset(
			new Uint8Array([1]),
			"/images/uploads/p.png",
			async () => null,
		);
		expect(out).toBeNull();
		vi.doUnmock("sharp");
	});

	it("strips the /images/uploads/ prefix from the basename", async () => {
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(
			new Uint8Array([1]),
			"/images/uploads/folder/p.png",
			async (n, _b) => {
				stored.push(n);
				return `/images/${n}`;
			},
		);
		expect(stored[0]).toBe("folder/p-400w.webp");
		vi.doUnmock("sharp");
	});

	it("strips the /images/ prefix when uploads/ is absent", async () => {
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(
			new Uint8Array([1]),
			"/images/seeded/x.png",
			async (n, _b) => {
				stored.push(n);
				return `/images/${n}`;
			},
		);
		expect(stored[0]).toBe("seeded/x-400w.webp");
		vi.doUnmock("sharp");
	});

	it("calls sharp.resize with width AND withoutEnlargement:true (not {})", async () => {
		// Pins the ObjectLiteral and BooleanLiteral mutations on the resize args.
		const resizeCalls: Array<Record<string, unknown>> = [];
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: (opts: Record<string, unknown>) => {
					resizeCalls.push(opts);
					return factory(_buf);
				},
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		await generateSrcset(
			new Uint8Array([1]),
			"/images/uploads/p.png",
			async (_n, _b) => "/images/x.webp",
		);
		expect(resizeCalls).toHaveLength(3);
		expect(resizeCalls[0]?.width).toBe(400);
		expect(resizeCalls[1]?.width).toBe(800);
		expect(resizeCalls[2]?.width).toBe(1200);
		for (const c of resizeCalls) {
			expect(c.withoutEnlargement).toBe(true);
		}
		vi.doUnmock("sharp");
	});

	it("treats a leading-dot path as ext-less basename (dot at index 0)", async () => {
		// Pins EqualityOperator `dot > 0` -> `dot >= 0` (boundary at 0).
		// With the mutant, `.hidden` would be sliced to "" instead of kept whole.
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(new Uint8Array([1]), ".hidden", async (n, _b) => {
			stored.push(n);
			return `/images/${n}`;
		});
		expect(stored[0]).toBe(".hidden-400w.webp");
		vi.doUnmock("sharp");
	});

	it("regex anchors: only strips /images/uploads/ when at the start", async () => {
		// Pins the Regex anchor `^\/images\/uploads\/` -> `\/images\/uploads\/`.
		// With the anchor dropped, the mutant would also strip mid-path occurrences.
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(
			new Uint8Array([1]),
			"/cdn/images/uploads/p.png",
			async (n, _b) => {
				stored.push(n);
				return `/images/${n}`;
			},
		);
		// The leading "/cdn/" should remain because /images/uploads/ is mid-path.
		expect(stored[0]).toBe("/cdn/images/uploads/p-400w.webp");
		vi.doUnmock("sharp");
	});

	it("regex anchors: only strips /images/ when at the start", async () => {
		// Pins the Regex anchor `^\/images\/` -> `\/images\/`.
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(
			new Uint8Array([1]),
			"/cdn/images/p.png",
			async (n, _b) => {
				stored.push(n);
				return `/images/${n}`;
			},
		);
		expect(stored[0]).toBe("/cdn/images/p-400w.webp");
		vi.doUnmock("sharp");
	});

	it("handles an extensionless path (no dot) by treating the whole path as basename", async () => {
		vi.doMock("sharp", () => {
			const factory = (_buf: Buffer) => ({
				resize: () => factory(_buf),
				webp: () => factory(_buf),
				toBuffer: async () => Buffer.from([1]),
			});
			return { default: factory };
		});
		const stored: string[] = [];
		await generateSrcset(
			new Uint8Array([1]),
			"/images/uploads/photo",
			async (n, _b) => {
				stored.push(n);
				return `/images/${n}`;
			},
		);
		expect(stored[0]).toBe("photo-400w.webp");
		vi.doUnmock("sharp");
	});
});
