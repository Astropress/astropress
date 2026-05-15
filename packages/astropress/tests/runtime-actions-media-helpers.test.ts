// Unit tests for runtime-actions-media-helpers.ts, exercising helpers directly
// to pin every behavioural branch: dimension detection, thumbnail generation,
// responsive-format gating, and the storage-callback contracts for thumbnails
// and srcset variants.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockImageSize, mockSharp, mockStoreMedia, mockGenerateSrcset, sharpInstance } = vi.hoisted(
	() => {
		const sharpInstance = {
			resize: vi.fn(),
			webp: vi.fn(),
			toBuffer: vi.fn(),
		};
		return {
			mockImageSize: vi.fn(),
			mockSharp: vi.fn(),
			mockStoreMedia: vi.fn(),
			mockGenerateSrcset: vi.fn(),
			sharpInstance,
		};
	},
);

vi.mock("image-size", () => ({ imageSize: mockImageSize }));
vi.mock("sharp", () => ({ default: mockSharp }));
vi.mock("../src/runtime-media-storage", () => ({
	storeRuntimeMediaObject: mockStoreMedia,
	deleteRuntimeMediaObject: vi.fn(),
}));
vi.mock("../src/runtime-media-storage.js", () => ({
	storeRuntimeMediaObject: mockStoreMedia,
	deleteRuntimeMediaObject: vi.fn(),
}));
vi.mock("../src/local-image-storage.js", () => ({
	generateSrcset: mockGenerateSrcset,
}));

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let detectImageDimensions: typeof import("../src/runtime-actions-media-helpers.js").detectImageDimensions;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let generateThumbnail: typeof import("../src/runtime-actions-media-helpers.js").generateThumbnail;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let isResponsiveImageFormat: typeof import("../src/runtime-actions-media-helpers.js").isResponsiveImageFormat;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let generateAndStoreThumbnail: typeof import("../src/runtime-actions-media-helpers.js").generateAndStoreThumbnail;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let generateAndStoreSrcset: typeof import("../src/runtime-actions-media-helpers.js").generateAndStoreSrcset;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let detectImageDimensionsForMime: typeof import("../src/runtime-actions-media-helpers.js").detectImageDimensionsForMime;

beforeEach(async () => {
	vi.resetModules();
	({
		detectImageDimensions,
		generateThumbnail,
		isResponsiveImageFormat,
		generateAndStoreThumbnail,
		generateAndStoreSrcset,
		detectImageDimensionsForMime,
	} = await import("../src/runtime-actions-media-helpers.js"));
	mockImageSize.mockReset();
	mockSharp.mockReset();
	mockStoreMedia.mockReset();
	mockGenerateSrcset.mockReset();
	sharpInstance.resize.mockReset();
	sharpInstance.webp.mockReset();
	sharpInstance.toBuffer.mockReset();
	sharpInstance.resize.mockReturnValue(sharpInstance);
	sharpInstance.webp.mockReturnValue(sharpInstance);
	mockSharp.mockReturnValue(sharpInstance);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("detectImageDimensions", () => {
	it("returns null when only width is detected (height missing)", async () => {
		mockImageSize.mockReturnValue({ width: 200 });
		const result = await detectImageDimensions(new Uint8Array([1, 2]));
		expect(result).toBeNull();
	});

	it("returns null when only height is detected (width missing)", async () => {
		mockImageSize.mockReturnValue({ height: 300 });
		const result = await detectImageDimensions(new Uint8Array([1, 2]));
		expect(result).toBeNull();
	});

	it("returns the {width,height} object when both are detected", async () => {
		mockImageSize.mockReturnValue({ width: 200, height: 150, type: "png" });
		const result = await detectImageDimensions(new Uint8Array([1, 2]));
		expect(result).toEqual({ width: 200, height: 150 });
	});

	it("returns null (not undefined) when image-size throws", async () => {
		mockImageSize.mockImplementation(() => {
			throw new Error("bad image");
		});
		const result = await detectImageDimensions(new Uint8Array([1, 2]));
		expect(result).toBeNull();
	});
});

describe("generateThumbnail", () => {
	it("invokes sharp().resize({width:400}).webp().toBuffer() and returns its bytes", async () => {
		const out = Buffer.from([0xaa, 0xbb, 0xcc]);
		sharpInstance.toBuffer.mockResolvedValue(out);
		const result = await generateThumbnail(new Uint8Array([0xff]), 800);
		expect(sharpInstance.resize).toHaveBeenCalledWith({ width: 400 });
		expect(sharpInstance.webp).toHaveBeenCalled();
		expect(result).toBeInstanceOf(Uint8Array);
		expect(Array.from(result as Uint8Array)).toEqual([0xaa, 0xbb, 0xcc]);
	});

	it("returns null (not undefined) when sharp throws", async () => {
		mockSharp.mockImplementation(() => {
			throw new Error("no sharp");
		});
		const result = await generateThumbnail(new Uint8Array([0xff]), 800);
		expect(result).toBeNull();
	});
});

describe("isResponsiveImageFormat", () => {
	it("returns true for image/jpeg", () => {
		expect(isResponsiveImageFormat("image/jpeg")).toBe(true);
	});
	it("returns true for image/png", () => {
		expect(isResponsiveImageFormat("image/png")).toBe(true);
	});
	it("returns false for image/svg+xml", () => {
		expect(isResponsiveImageFormat("image/svg+xml")).toBe(false);
	});
	it("returns false for non-image types", () => {
		expect(isResponsiveImageFormat("application/pdf")).toBe(false);
	});
});

describe("generateAndStoreThumbnail", () => {
	const input = {
		filename: "photo.jpg",
		bytes: new Uint8Array([0xff, 0xd8]),
		mimeType: "image/jpeg",
		title: "Photo",
		altText: "alt",
	};

	it("returns null without calling sharp when width is exactly 400", async () => {
		const result = await generateAndStoreThumbnail(input, "photo.jpg", 400, null);
		expect(result).toBeNull();
		expect(mockSharp).not.toHaveBeenCalled();
		expect(mockStoreMedia).not.toHaveBeenCalled();
	});

	it("generates a thumbnail when width is greater than 400 (boundary 401)", async () => {
		sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0x11]));
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: { publicPath: "/p/photo-thumb.webp" },
		});
		const result = await generateAndStoreThumbnail(input, "photo.jpg", 401, null);
		expect(result).toBe("/p/photo-thumb.webp");
		expect(mockSharp).toHaveBeenCalled();
	});

	it("returns null when thumbnail generation produces no bytes (sharp unavailable)", async () => {
		mockSharp.mockImplementation(() => {
			throw new Error("no sharp");
		});
		const result = await generateAndStoreThumbnail(input, "photo.jpg", 800, null);
		expect(result).toBeNull();
		expect(mockStoreMedia).not.toHaveBeenCalled();
	});

	it("stores the thumbnail with filename=<basename>-thumb.webp and mimeType=image/webp, merging the input object", async () => {
		sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0x22]));
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: { publicPath: "/p/photo-thumb.webp" },
		});
		await generateAndStoreThumbnail(input, "photo.jpg", 800, null);
		expect(mockStoreMedia).toHaveBeenCalledTimes(1);
		const [arg, localsArg] = mockStoreMedia.mock.calls[0];
		expect(arg).toMatchObject({
			filename: "photo-thumb.webp",
			mimeType: "image/webp",
			title: "Photo",
			altText: "alt",
		});
		expect(arg.bytes).toBeInstanceOf(Uint8Array);
		expect(Array.from(arg.bytes as Uint8Array)).toEqual([0x22]);
		expect(localsArg).toBeNull();
	});

	it("appends -thumb.webp without splitting on dot for filenames lacking an extension", async () => {
		sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0x33]));
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: { publicPath: "/p/noext-thumb.webp" },
		});
		await generateAndStoreThumbnail(input, "noext", 800, null);
		expect(mockStoreMedia.mock.calls[0][0]).toMatchObject({
			filename: "noext-thumb.webp",
		});
	});

	it("treats a leading-dot filename (dot at index 0) as having no extension", async () => {
		// lastIndexOf(".") === 0 → `dot > 0` is false → basename is the whole filename
		sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0x44]));
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: { publicPath: "/p/.hidden-thumb.webp" },
		});
		await generateAndStoreThumbnail(input, ".hidden", 800, null);
		expect(mockStoreMedia.mock.calls[0][0]).toMatchObject({
			filename: ".hidden-thumb.webp",
		});
	});

	it("returns null (not the asset path) when thumbnail storage fails", async () => {
		sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0x55]));
		mockStoreMedia.mockResolvedValue({ ok: false, error: "boom" });
		const result = await generateAndStoreThumbnail(input, "photo.jpg", 800, null);
		expect(result).toBeNull();
	});
});

describe("generateAndStoreSrcset", () => {
	const input = {
		filename: "photo.jpg",
		bytes: new Uint8Array([0xff, 0xd8]),
		mimeType: "image/jpeg",
		title: "Photo",
		altText: "alt",
	};

	it("invokes generateSrcset with (bytes, publicPath, callback) and returns its result", async () => {
		mockGenerateSrcset.mockResolvedValue("/p/photo-400w.webp 400w");
		const result = await generateAndStoreSrcset(input, "/p/photo.jpg", null);
		expect(mockGenerateSrcset).toHaveBeenCalledTimes(1);
		const [bytesArg, pathArg, cb] = mockGenerateSrcset.mock.calls[0];
		expect(bytesArg).toBe(input.bytes);
		expect(pathArg).toBe("/p/photo.jpg");
		expect(typeof cb).toBe("function");
		expect(result).toBe("/p/photo-400w.webp 400w");
	});

	it("callback forwards (filename, bytes) to storeRuntimeMediaObject with mimeType image/webp, merging the input", async () => {
		mockStoreMedia.mockResolvedValue({
			ok: true,
			asset: { publicPath: "/p/photo-400w.webp" },
		});
		mockGenerateSrcset.mockImplementation(
			async (
				_bytes: Uint8Array,
				_path: string,
				cb: (f: string, b: Uint8Array) => Promise<string | null>,
			) => cb("photo-400w.webp", new Uint8Array([0x66])),
		);
		const result = await generateAndStoreSrcset(input, "/p/photo.jpg", null);
		expect(result).toBe("/p/photo-400w.webp");
		const [arg] = mockStoreMedia.mock.calls[0];
		expect(arg).toMatchObject({
			filename: "photo-400w.webp",
			mimeType: "image/webp",
			title: "Photo",
			altText: "alt",
		});
		expect(Array.from(arg.bytes as Uint8Array)).toEqual([0x66]);
	});

	it("callback returns null when variant storage fails", async () => {
		mockStoreMedia.mockResolvedValue({ ok: false, error: "nope" });
		let callbackResult: string | null = "unset";
		mockGenerateSrcset.mockImplementation(
			async (
				_bytes: Uint8Array,
				_path: string,
				cb: (f: string, b: Uint8Array) => Promise<string | null>,
			) => {
				callbackResult = await cb("photo-400w.webp", new Uint8Array([0x77]));
				return null;
			},
		);
		await generateAndStoreSrcset(input, "/p/photo.jpg", null);
		expect(callbackResult).toBeNull();
	});
});

describe("detectImageDimensionsForMime", () => {
	it("returns null without invoking image-size for non-image mimeTypes", async () => {
		const result = await detectImageDimensionsForMime(new Uint8Array([1, 2]), "application/pdf");
		expect(result).toBeNull();
		expect(mockImageSize).not.toHaveBeenCalled();
	});

	it("delegates to detectImageDimensions when the mime begins with image/", async () => {
		mockImageSize.mockReturnValue({ width: 10, height: 20 });
		const result = await detectImageDimensionsForMime(new Uint8Array([1, 2]), "image/png");
		expect(result).toEqual({ width: 10, height: 20 });
		expect(mockImageSize).toHaveBeenCalledTimes(1);
	});

	it("returns null for the empty mimeType (does not blindly call image-size)", async () => {
		const result = await detectImageDimensionsForMime(new Uint8Array([1, 2]), "");
		expect(result).toBeNull();
		expect(mockImageSize).not.toHaveBeenCalled();
	});
});
