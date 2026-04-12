import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { makeLocals } from "./helpers/make-locals.js";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import {
  createRuntimeMediaAsset,
  deleteRuntimeMediaAsset,
  updateRuntimeMediaAsset,
} from "../src/runtime-actions-media";

const { mockStoreMedia, mockDeleteMedia, mockImageSize, mockSharp, mockGenerateSrcset } = vi.hoisted(() => ({
  mockStoreMedia: vi.fn(),
  mockDeleteMedia: vi.fn(),
  mockImageSize: vi.fn(),
  mockSharp: vi.fn(),
  mockGenerateSrcset: vi.fn(),
}));

vi.mock("../src/runtime-media-storage", () => ({
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

beforeEach(() => {
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
  // Default: srcset returns null (avoids undefined binding to SQLite parameter)
  mockGenerateSrcset.mockResolvedValue(null);
});

describe("createRuntimeMediaAsset", () => {
  it("rejects a file that exceeds the configured maxUploadBytes limit", async () => {
    registerCms({ templateKeys: ["content"], siteUrl: "https://example.com", seedPages: [], archives: [], translationStatus: [], maxUploadBytes: 100 });
    const bigBytes = new Uint8Array(101);
    const result = await createRuntimeMediaAsset({ filename: "big.png", bytes: bigBytes, mimeType: "image/png" }, actor, locals);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("too large") });
    expect(mockStoreMedia).not.toHaveBeenCalled();
  });

  it("allows a file within the configured maxUploadBytes limit", async () => {
    registerCms({ templateKeys: ["content"], siteUrl: "https://example.com", seedPages: [], archives: [], translationStatus: [], maxUploadBytes: 100 });
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
    const result = await createRuntimeMediaAsset({ filename: "small.png", bytes: new Uint8Array(50), mimeType: "image/png" }, actor, locals);
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
      { filename: "new.png", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
      actor,
      locals,
    );

    expect(result).toMatchObject({ ok: true, id: "asset-new" });
    const row = db.prepare("SELECT id FROM media_assets WHERE id = 'asset-new'").get() as { id: string } | undefined;
    expect(row?.id).toBe("asset-new");
  });

  it("returns not-ok when storage fails", async () => {
    mockStoreMedia.mockResolvedValue({ ok: false, error: "Storage unavailable" });
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
      { filename: "photo.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
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
      { filename: "doc.pdf", bytes: new Uint8Array([0x25, 0x50]), mimeType: "application/pdf" },
      actor,
      locals,
    );

    const row = db
      .prepare("SELECT width, height FROM media_assets WHERE id = 'asset-pdf'")
      .get() as { width: number | null; height: number | null } | undefined;
    expect(row).toBeDefined();
    expect(row?.width).toBeNull();
    expect(row?.height).toBeNull();
  });

  it("schema includes thumbnail_url column in media_assets", () => {
    const row = db
      .prepare("SELECT thumbnail_url FROM media_assets WHERE id = 'asset-1'")
      .get() as { thumbnail_url: string | null } | undefined;
    // Column exists (query doesn't throw)
    expect(row).toBeDefined();
    expect(row?.thumbnail_url ?? null).toBeNull();
  });
});

describe("updateRuntimeMediaAsset", () => {
  it("updates title and alt text", async () => {
    const result = await updateRuntimeMediaAsset({ id: "asset-1", title: "New Title", altText: "New Alt" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'asset-1'").get() as { title: string; alt_text: string };
    expect(row.title).toBe("New Title");
    expect(row.alt_text).toBe("New Alt");
  });

  it("returns not-ok for unknown asset id", async () => {
    const result = await updateRuntimeMediaAsset({ id: "ghost" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for empty id", async () => {
    const result = await updateRuntimeMediaAsset({ id: "   " }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("deleteRuntimeMediaAsset", () => {
  it("soft-deletes an asset and calls storage cleanup", async () => {
    mockDeleteMedia.mockResolvedValue(undefined);
    const result = await deleteRuntimeMediaAsset("asset-1", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT deleted_at FROM media_assets WHERE id = 'asset-1'").get() as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
    expect(mockDeleteMedia).toHaveBeenCalledOnce();
  });

  it("returns not-ok for unknown id", async () => {
    const result = await deleteRuntimeMediaAsset("ghost", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for empty id", async () => {
    const result = await deleteRuntimeMediaAsset("  ", actor, locals);
    expect(result).toMatchObject({ ok: false });
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
      { filename: "photo.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
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
      { filename: "small.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
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

    const thumbAsset = { ...baseAsset, asset: { ...baseAsset.asset, id: "asset-thumb", publicPath: "/images/uploads/photo-thumb.webp", storedFilename: "photo-thumb.webp" } };
    mockStoreMedia
      .mockResolvedValueOnce(baseAsset)   // main image
      .mockResolvedValueOnce(thumbAsset); // thumbnail

    const result = await createRuntimeMediaAsset(
      { filename: "photo.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
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
      { filename: "photo.jpg", bytes: new Uint8Array([0xff, 0xd8]), mimeType: "image/jpeg" },
      actor,
      locals,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thumbnailUrl).toBeUndefined();
    }
  });

  it("SVG uploads skip srcset generation", async () => {
    mockImageSize.mockReturnValue({ width: 800, height: 600 });
    mockStoreMedia.mockResolvedValue({ ...baseAsset, asset: { ...baseAsset.asset, mimeType: "image/svg+xml" } });

    const result = await createRuntimeMediaAsset(
      { filename: "icon.svg", bytes: new Uint8Array([0x3c, 0x73]), mimeType: "image/svg+xml" },
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
