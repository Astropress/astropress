import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { makeLocals } from "./helpers/make-locals.js";
import {
  createRuntimeMediaAsset,
  deleteRuntimeMediaAsset,
  updateRuntimeMediaAsset,
} from "../src/runtime-actions-media";

const { mockStoreMedia, mockDeleteMedia } = vi.hoisted(() => ({
  mockStoreMedia: vi.fn(),
  mockDeleteMedia: vi.fn(),
}));

vi.mock("../src/runtime-media-storage", () => ({
  storeRuntimeMediaObject: mockStoreMedia,
  deleteRuntimeMediaObject: mockDeleteMedia,
}));

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  return db;
}

const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
  db = makeDb();
  locals = makeLocals(db);
  registerCms({ templateKeys: ["content"], siteUrl: "https://example.com", seedPages: [], archives: [], translationStatus: [] });

  db.prepare(
    "INSERT INTO media_assets (id, local_path, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?)",
  ).run("asset-1", "/images/test.png", "Alt text", "test.png", "admin@test.local");

  mockStoreMedia.mockReset();
  mockDeleteMedia.mockReset();
});

describe("createRuntimeMediaAsset", () => {
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
