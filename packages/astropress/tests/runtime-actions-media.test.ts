import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let createRuntimeMediaAsset: typeof import("../src/runtime-actions-media.js").createRuntimeMediaAsset;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let deleteRuntimeMediaAsset: typeof import("../src/runtime-actions-media.js").deleteRuntimeMediaAsset;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let updateRuntimeMediaAsset: typeof import("../src/runtime-actions-media.js").updateRuntimeMediaAsset;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let checkUploadSize: typeof import("../src/runtime-actions-media.js").checkUploadSize;

const {
	mockStoreMedia,
	mockDeleteMedia,
	mockImageSize,
	mockSharp,
	mockGenerateSrcset,
	mockLoadLocalAdminStore,
	fakeLocalStore,
} = vi.hoisted(() => ({
	mockStoreMedia: vi.fn(),
	mockDeleteMedia: vi.fn(),
	mockImageSize: vi.fn(),
	mockSharp: vi.fn(),
	mockGenerateSrcset: vi.fn(),
	mockLoadLocalAdminStore: vi.fn(),
	fakeLocalStore: {
		createMediaAsset: vi.fn(),
		updateMediaAsset: vi.fn(),
		deleteMediaAsset: vi.fn(),
	},
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

vi.mock("../src/runtime-media-storage", () => ({
	storeRuntimeMediaObject: mockStoreMedia,
	deleteRuntimeMediaObject: mockDeleteMedia,
}));

vi.mock("../src/runtime-media-storage.js", () => ({
	storeRuntimeMediaObject: mockStoreMedia,
	deleteRuntimeMediaObject: mockDeleteMedia,
}));

vi.mock("image-size", () => ({
	imageSize: mockImageSize,
}));

vi.mock("sharp", () => ({
	default: mockSharp,
}));

vi.mock("../src/local-image-storage.js", () => ({
	generateSrcset: mockGenerateSrcset,
}));

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(async () => {
	vi.resetModules();
	({ createRuntimeMediaAsset, deleteRuntimeMediaAsset, updateRuntimeMediaAsset, checkUploadSize } =
		await import("../src/runtime-actions-media.js"));
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);

	db.prepare(
		"INSERT INTO media_assets (id, local_path, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?)",
	).run("asset-1", "/images/test.png", "Alt text", "test.png", "admin@test.local");

	mockStoreMedia.mockReset();
	mockDeleteMedia.mockReset();
	mockImageSize.mockReset();
	mockSharp.mockReset();
	mockGenerateSrcset.mockReset();
	mockLoadLocalAdminStore.mockReset();
	fakeLocalStore.createMediaAsset.mockReset();
	fakeLocalStore.updateMediaAsset.mockReset();
	fakeLocalStore.deleteMediaAsset.mockReset();
	mockLoadLocalAdminStore.mockResolvedValue(fakeLocalStore);
	// Default: srcset returns null (avoids undefined binding to SQLite parameter)
	mockGenerateSrcset.mockResolvedValue(null);
});

afterAll(() => {
	vi.resetModules();
});

describe("checkUploadSize (#102 — pre-buffer size guard)", () => {
	function withMax(max: number) {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			maxUploadBytes: max,
		});
	}

	it("accepts a byte length exactly at the configured maximum (boundary)", () => {
		withMax(100);
		expect(checkUploadSize(100)).toEqual({ ok: true });
	});

	it("rejects a byte length one over the maximum with the shared error shape", () => {
		withMax(100);
		const r = checkUploadSize(101);
		expect(r.ok).toBe(false);
		expect((r as { ok: false; error: string }).error).toContain("too large");
	});

	it("operates on a length, so the route can reject File.size before buffering", () => {
		withMax(5);
		// Simulates `checkUploadSize(file.size)` in pages/ap-admin/actions/media-upload.ts.
		expect(checkUploadSize(6).ok).toBe(false);
		expect(checkUploadSize(5).ok).toBe(true);
	});
});

describe("createRuntimeMediaAsset", () => {
	it("rejects a file that exceeds the configured maxUploadBytes limit", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			maxUploadBytes: 100,
		});
		const bigBytes = new Uint8Array(101);
		const result = await createRuntimeMediaAsset(
			{ filename: "big.png", bytes: bigBytes, mimeType: "image/png" },
			actor,
			locals,
		);
		expect(result).toMatchObject({
			ok: false,
			error: expect.stringContaining("too large"),
		});
		expect(mockStoreMedia).not.toHaveBeenCalled();
	});

	it("allows a file within the configured maxUploadBytes limit", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			maxUploadBytes: 100,
		});
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: {
				id: "asset-small",
				publicPath: "/images/small.png",
				r2Key: null,
				mimeType: "image/png",
				fileSize: 50,
				altText: "",
				title: "small.png",
				storedFilename: "small.png",
			},
		});
		const result = await createRuntimeMediaAsset(
			{
				filename: "small.png",
				bytes: new Uint8Array(50),
				mimeType: "image/png",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("inserts a media asset row after successful storage", async () => {
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: {
				id: "asset-new",
				publicPath: "/images/uploads/new.png",
				r2Key: null,
				mimeType: "image/png",
				fileSize: 1024,
				altText: "Alt",
				title: "new.png",
				storedFilename: "new.png",
			},
		});

		const result = await createRuntimeMediaAsset(
			{
				filename: "new.png",
				bytes: new Uint8Array([1, 2, 3]),
				mimeType: "image/png",
			},
			actor,
			locals,
		);

		expect(result).toMatchObject({ ok: true, id: "asset-new" });
		const row = db.prepare("SELECT id FROM media_assets WHERE id = 'asset-new'").get() as
			| { id: string }
			| undefined;
		expect(row?.id).toBe("asset-new");
	});

	it("returns not-ok when storage fails", async () => {
		mockStoreMedia.mockResolvedValue({
			ok: false,
			error: "Storage unavailable",
		});
		const result = await createRuntimeMediaAsset(
			{ filename: "fail.png", bytes: new Uint8Array(), mimeType: "image/png" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("createRuntimeMediaAsset — dimension detection", () => {
	it("stores width and height in media_assets when image-size detects dimensions", async () => {
		mockImageSize.mockReturnValue({ width: 800, height: 600 });
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: {
				id: "asset-dims",
				publicPath: "/images/uploads/photo.jpg",
				r2Key: null,
				mimeType: "image/jpeg",
				fileSize: 2048,
				altText: "",
				title: "photo.jpg",
				storedFilename: "photo.jpg",
			},
		});

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT width, height FROM media_assets WHERE id = 'asset-dims'")
			.get() as { width: number | null; height: number | null } | undefined;
		expect(row).toBeDefined();
		expect(row?.width).toBe(800);
		expect(row?.height).toBe(600);
	});

	it("stores null width/height for non-image uploads", async () => {
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: {
				id: "asset-pdf",
				publicPath: "/uploads/doc.pdf",
				r2Key: null,
				mimeType: "application/pdf",
				fileSize: 512,
				altText: "",
				title: "doc.pdf",
				storedFilename: "doc.pdf",
			},
		});

		await createRuntimeMediaAsset(
			{
				filename: "doc.pdf",
				bytes: new Uint8Array([0x25, 0x50]),
				mimeType: "application/pdf",
			},
			actor,
			locals,
		);

		const row = db.prepare("SELECT width, height FROM media_assets WHERE id = 'asset-pdf'").get() as
			| { width: number | null; height: number | null }
			| undefined;
		expect(row).toBeDefined();
		expect(row?.width).toBeNull();
		expect(row?.height).toBeNull();
	});

	it("schema includes thumbnail_url column in media_assets", () => {
		const row = db.prepare("SELECT thumbnail_url FROM media_assets WHERE id = 'asset-1'").get() as
			| { thumbnail_url: string | null }
			| undefined;
		// Column exists (query doesn't throw)
		expect(row).toBeDefined();
		expect(row?.thumbnail_url ?? null).toBeNull();
	});
});

describe("updateRuntimeMediaAsset", () => {
	it("updates title and alt text", async () => {
		const result = await updateRuntimeMediaAsset(
			{ id: "asset-1", title: "New Title", altText: "New Alt" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'asset-1'")
			.get() as { title: string; alt_text: string };
		expect(row.title).toBe("New Title");
		expect(row.alt_text).toBe("New Alt");
	});

	it("returns not-ok for unknown asset id", async () => {
		const result = await updateRuntimeMediaAsset({ id: "ghost" }, actor, locals);
		expect(result).toMatchObject({
			ok: false,
			error: "The selected media asset could not be updated.",
		});
	});

	it("returns not-ok for empty id", async () => {
		const result = await updateRuntimeMediaAsset({ id: "   " }, actor, locals);
		expect(result).toMatchObject({ ok: false, error: "Media asset id is required." });
	});

	it("trims surrounding whitespace from the id before looking up the asset", async () => {
		// Pins `input.id.trim()`: without the trim, the padded id never matches.
		const result = await updateRuntimeMediaAsset({ id: "  asset-1  " }, actor, locals);
		expect(result).toMatchObject({ ok: true });
	});

	it("trims surrounding whitespace from title and altText before storing", async () => {
		const result = await updateRuntimeMediaAsset(
			{ id: "asset-1", title: "  Padded Title  ", altText: "  Padded Alt  " },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'asset-1'")
			.get() as { title: string; alt_text: string };
		expect(row.title).toBe("Padded Title");
		expect(row.alt_text).toBe("Padded Alt");
	});

	it("records a media.update audit event referencing the asset id", async () => {
		await updateRuntimeMediaAsset({ id: "asset-1", title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT action, resource_type, summary FROM audit_events WHERE resource_id = 'asset-1' AND action = 'media.update'",
			)
			.get() as { action: string; resource_type: string; summary: string };
		expect(row.action).toBe("media.update");
		expect(row.resource_type).toBe("content");
		expect(row.summary).toBe("Updated media metadata for asset-1.");
	});

	it("delegates to the local store when no D1 binding is present", async () => {
		fakeLocalStore.updateMediaAsset.mockResolvedValue({ ok: true });
		const input = { id: "asset-1", title: "Local" };
		const result = await updateRuntimeMediaAsset(input, actor, null);
		expect(fakeLocalStore.updateMediaAsset).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});

	it("omitting title and altText binds empty strings", async () => {
		const result = await updateRuntimeMediaAsset({ id: "asset-1" }, actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'asset-1'")
			.get() as { title: string; alt_text: string };
		expect(row.title).toBe("");
		expect(row.alt_text).toBe("");
	});
});

describe("deleteRuntimeMediaAsset", () => {
	it("soft-deletes an asset and calls storage cleanup", async () => {
		mockDeleteMedia.mockResolvedValue(undefined);
		const result = await deleteRuntimeMediaAsset("asset-1", actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT deleted_at FROM media_assets WHERE id = 'asset-1'").get() as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
		expect(mockDeleteMedia).toHaveBeenCalledOnce();
		// Pins the storage-cleanup object literal: localPath/r2Key come from the row.
		expect(mockDeleteMedia).toHaveBeenCalledWith(
			{ localPath: "/images/test.png", r2Key: null },
			locals,
		);
	});

	it("returns not-ok for unknown id", async () => {
		const result = await deleteRuntimeMediaAsset("ghost", actor, locals);
		expect(result).toMatchObject({
			ok: false,
			error: "The selected media asset could not be deleted.",
		});
	});

	it("returns not-ok for empty id", async () => {
		const result = await deleteRuntimeMediaAsset("  ", actor, locals);
		expect(result).toMatchObject({ ok: false, error: "Media asset id is required." });
	});

	it("trims surrounding whitespace from the id before looking up the asset", async () => {
		// Pins `id.trim()`: without the trim, the padded id never matches.
		mockDeleteMedia.mockResolvedValue(undefined);
		const result = await deleteRuntimeMediaAsset("  asset-1  ", actor, locals);
		expect(result).toMatchObject({ ok: true });
	});

	it("records a media.delete audit event referencing the asset id", async () => {
		mockDeleteMedia.mockResolvedValue(undefined);
		await deleteRuntimeMediaAsset("asset-1", actor, locals);
		const row = db
			.prepare(
				"SELECT action, resource_type, summary FROM audit_events WHERE resource_id = 'asset-1' AND action = 'media.delete'",
			)
			.get() as { action: string; resource_type: string; summary: string };
		expect(row.action).toBe("media.delete");
		expect(row.resource_type).toBe("content");
		expect(row.summary).toBe("Deleted media asset asset-1.");
	});

	it("delegates to the local store when no D1 binding is present", async () => {
		fakeLocalStore.deleteMediaAsset.mockResolvedValue({ ok: true });
		const result = await deleteRuntimeMediaAsset("asset-1", actor, null);
		expect(fakeLocalStore.deleteMediaAsset).toHaveBeenCalledWith("asset-1", actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("createRuntimeMediaAsset — thumbnail and srcset", () => {
	const baseAsset = {
		ok: true as const,
		asset: {
			id: "asset-img",
			publicPath: "/images/uploads/photo.jpg",
			r2Key: null,
			mimeType: "image/jpeg",
			fileSize: 2048,
			altText: "",
			title: "photo.jpg",
			storedFilename: "photo.jpg",
		},
	};

	it("image-size returning no width/height leaves imageDimensions null — no thumbnail or srcset", async () => {
		mockImageSize.mockReturnValue({});
		mockStoreMedia.mockResolvedValue(baseAsset);

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.thumbnailUrl).toBeUndefined();
			expect(result.srcset).toBeUndefined();
		}
		// Only one storage call — no thumbnail or srcset variants stored
		expect(mockStoreMedia).toHaveBeenCalledOnce();
	});

	it("image ≤ 400px wide — no thumbnail generated", async () => {
		mockImageSize.mockReturnValue({ width: 200, height: 150 });
		mockStoreMedia.mockResolvedValue(baseAsset);

		const result = await createRuntimeMediaAsset(
			{
				filename: "small.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.thumbnailUrl).toBeUndefined();
		}
		// Sharp must not have been called for a small image
		expect(mockSharp).not.toHaveBeenCalled();
		expect(mockStoreMedia).toHaveBeenCalledOnce();
	});

	it("image > 400px wide — thumbnail generated and stored", async () => {
		mockImageSize.mockReturnValue({ width: 800, height: 600 });

		const thumbBuffer = Buffer.from([0x00, 0x01, 0x02]);
		const sharpInstance = {
			resize: vi.fn().mockReturnThis(),
			webp: vi.fn().mockReturnThis(),
			toBuffer: vi.fn().mockResolvedValue(thumbBuffer),
		};
		mockSharp.mockReturnValue(sharpInstance);

		const thumbAsset = {
			...baseAsset,
			asset: {
				...baseAsset.asset,
				id: "asset-thumb",
				publicPath: "/images/uploads/photo-thumb.webp",
				storedFilename: "photo-thumb.webp",
			},
		};
		mockStoreMedia
			.mockResolvedValueOnce(baseAsset) // main image
			.mockResolvedValueOnce(thumbAsset); // thumbnail

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.thumbnailUrl).toBe("/images/uploads/photo-thumb.webp");
		}
		expect(mockStoreMedia).toHaveBeenCalledTimes(2);
	});

	it("thumbnail storage failure — thumbnailUrl absent in result", async () => {
		mockImageSize.mockReturnValue({ width: 800, height: 600 });

		const sharpInstance = {
			resize: vi.fn().mockReturnThis(),
			webp: vi.fn().mockReturnThis(),
			toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x00])),
		};
		mockSharp.mockReturnValue(sharpInstance);

		mockStoreMedia
			.mockResolvedValueOnce(baseAsset)
			.mockResolvedValueOnce({ ok: false as const, error: "Storage failed" });

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.thumbnailUrl).toBeUndefined();
		}
	});

	it("srcset variant callback — stores each variant and returns its public path", async () => {
		mockImageSize.mockReturnValue({ width: 600, height: 400 });

		const variantAsset = {
			ok: true as const,
			asset: {
				id: "asset-srcset-400",
				publicPath: "/images/uploads/photo-400w.webp",
				r2Key: null,
				mimeType: "image/webp",
				fileSize: 512,
				altText: "",
				title: "photo-400w.webp",
				storedFilename: "photo-400w.webp",
			},
		};

		mockStoreMedia
			.mockResolvedValueOnce(baseAsset) // main image
			.mockResolvedValueOnce(variantAsset); // variant via callback

		// Make generateSrcset invoke the callback so the arrow function body is exercised
		mockGenerateSrcset.mockImplementation(
			async (
				_bytes: Uint8Array,
				_basePath: string | null,
				storeVariant: (f: string, b: Uint8Array) => Promise<string | null>,
			) => {
				const path = await storeVariant("photo-400w.webp", new Uint8Array([0x52, 0x49, 0x46]));
				return path ? `${path} 400w` : null;
			},
		);

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		// Two storage calls: main image + one variant via the callback
		expect(mockStoreMedia).toHaveBeenCalledTimes(2);
	});

	it("srcset variant callback — returns null when variant storage fails", async () => {
		mockImageSize.mockReturnValue({ width: 600, height: 400 });

		mockStoreMedia.mockResolvedValueOnce(baseAsset).mockResolvedValueOnce({
			ok: false as const,
			error: "Variant storage failed",
		});

		mockGenerateSrcset.mockImplementation(
			async (
				_bytes: Uint8Array,
				_basePath: string | null,
				storeVariant: (f: string, b: Uint8Array) => Promise<string | null>,
			) => {
				return await storeVariant("photo-400w.webp", new Uint8Array([0x52]));
			},
		);

		const result = await createRuntimeMediaAsset(
			{
				filename: "photo.jpg",
				bytes: new Uint8Array([0xff, 0xd8]),
				mimeType: "image/jpeg",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		expect(mockStoreMedia).toHaveBeenCalledTimes(2);
	});

	it("default maxUploadBytes is exactly 10 MiB when config omits the limit", async () => {
		// STANDARD_CMS_CONFIG (registered in beforeEach) has no maxUploadBytes.
		// A file of exactly 10 MiB must be accepted; arithmetic mutations of the
		// 10 * 1024 * 1024 default would shrink the limit and reject it.
		mockStoreMedia.mockResolvedValue(baseAsset);
		const tenMiB = await createRuntimeMediaAsset(
			{ filename: "ten.bin", bytes: new Uint8Array(10 * 1024 * 1024), mimeType: "image/jpeg" },
			actor,
			locals,
		);
		expect(tenMiB.ok).toBe(true);

		const overLimit = await createRuntimeMediaAsset(
			{ filename: "over.bin", bytes: new Uint8Array(10 * 1024 * 1024 + 1), mimeType: "image/jpeg" },
			actor,
			locals,
		);
		expect(overLimit).toMatchObject({ ok: false, error: expect.stringContaining("too large") });
	});

	it("accepts a file whose size exactly equals the configured limit", async () => {
		// Pins the `>` boundary: `>=` would reject an exactly-at-limit file.
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			maxUploadBytes: 100,
		});
		mockStoreMedia.mockResolvedValue(baseAsset);
		const result = await createRuntimeMediaAsset(
			{ filename: "exact.png", bytes: new Uint8Array(100), mimeType: "image/png" },
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
	});

	it("error message reports the configured limit in MiB", async () => {
		// Pins the `/ (1024 * 1024)` MiB conversion in the error string.
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			maxUploadBytes: 2 * 1024 * 1024,
		});
		const result = await createRuntimeMediaAsset(
			{ filename: "big.png", bytes: new Uint8Array(2 * 1024 * 1024 + 1), mimeType: "image/png" },
			actor,
			locals,
		);
		expect(result).toMatchObject({
			ok: false,
			error: "File too large — maximum upload size is 2.0 MiB",
		});
	});

	it("falls back to the default limit when peekCmsConfig returns null", async () => {
		// Pins the `peekCmsConfig()?.maxUploadBytes` optional chain: with the
		// chain removed, a null config makes checkUploadSize throw instead of
		// falling back to the 10 MiB default.
		const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
		(globalThis as Record<symbol, unknown>)[CMS_CONFIG_KEY] = null;
		mockStoreMedia.mockResolvedValue(baseAsset);
		const result = await createRuntimeMediaAsset(
			{ filename: "tiny.png", bytes: new Uint8Array(8), mimeType: "image/png" },
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
	});

	it("dispatches a media event carrying the asset id, filename, mime, size and actor", async () => {
		const events: unknown[] = [];
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			plugins: [
				{
					name: "capture",
					onMediaUpload: (event: unknown) => {
						events.push(event);
					},
				},
			],
		});
		mockStoreMedia.mockResolvedValue({
			...baseAsset,
			asset: { ...baseAsset.asset, id: "asset-evt", fileSize: 2048, mimeType: "image/jpeg" },
		});

		await createRuntimeMediaAsset(
			{ filename: "evt.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
			actor,
			locals,
		);

		expect(events).toEqual([
			{
				id: "asset-evt",
				filename: "evt.jpg",
				mimeType: "image/jpeg",
				size: 2048,
				actor: actor.email,
			},
		]);
	});

	it("records a media.upload audit event with the stored filename in its summary", async () => {
		mockStoreMedia.mockResolvedValue({
			...baseAsset,
			asset: { ...baseAsset.asset, id: "asset-audit", storedFilename: "audit-photo.jpg" },
		});

		await createRuntimeMediaAsset(
			{ filename: "audit.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
			actor,
			locals,
		);

		const row = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE resource_id = 'asset-audit'",
			)
			.get() as {
			action: string;
			resource_type: string;
			resource_id: string;
			summary: string;
		};
		expect(row.action).toBe("media.upload");
		expect(row.resource_type).toBe("content");
		expect(row.resource_id).toBe("asset-audit");
		expect(row.summary).toBe("Uploaded media asset audit-photo.jpg.");
	});

	it("delegates to the local store when no D1 binding is present", async () => {
		fakeLocalStore.createMediaAsset.mockResolvedValue({ ok: true, id: "local-asset" });
		const input = {
			filename: "local.png",
			bytes: new Uint8Array([1, 2, 3]),
			mimeType: "image/png",
		};
		const result = await createRuntimeMediaAsset(input, actor, null);
		expect(fakeLocalStore.createMediaAsset).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true, id: "local-asset" });
	});

	it("SVG uploads skip srcset generation", async () => {
		// Guard lives in this caller (!input.mimeType.includes("svg")), not in generateSrcset itself.
		mockImageSize.mockReturnValue({ width: 800, height: 600 });
		mockStoreMedia.mockResolvedValue({
			...baseAsset,
			asset: { ...baseAsset.asset, mimeType: "image/svg+xml" },
		});

		const result = await createRuntimeMediaAsset(
			{
				filename: "icon.svg",
				bytes: new Uint8Array([0x3c, 0x73]),
				mimeType: "image/svg+xml",
			},
			actor,
			locals,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.srcset).toBeUndefined();
		}
		expect(mockGenerateSrcset).not.toHaveBeenCalled();
	});
});
