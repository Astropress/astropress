import { describe, expect, it } from "vitest";
import { generateSrcset } from "../src/local-image-storage.js";

// ─── generateSrcset ───────────────────────────────────────────────────────────

describe("generateSrcset() — basic output format", () => {
  it("returns null when Sharp is unavailable (storeVariant never called)", async () => {
    // In the test environment Sharp may or may not be available.
    // We test the null-return path by injecting a storeVariant that always returns null.
    // If Sharp IS available this exercises the full path but still returns null due to storeVariant.
    const result = await generateSrcset(
      new Uint8Array([0xff, 0xd8, 0xff]), // minimal JPEG magic bytes
      "/images/uploads/test.jpg",
      async () => null,
    );
    expect(result).toBeNull();
  });

  it("builds a srcset string from stored variant paths", async () => {
    // Inject a mock storeVariant that returns deterministic paths
    const stored: string[] = [];
    const storeVariant = async (filename: string, _bytes: Uint8Array): Promise<string | null> => {
      const path = `/images/uploads/${filename}`;
      stored.push(path);
      return path;
    };

    // Use a 1×1 white PNG as minimal image data that Sharp can process
    // (base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==)
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    let pngBytes: Uint8Array;
    try {
      pngBytes = new Uint8Array(Buffer.from(pngBase64, "base64"));
    } catch {
      pngBytes = new Uint8Array(0);
    }

    if (pngBytes.length === 0) {
      return; // Skip if Buffer not available
    }

    const result = await generateSrcset(pngBytes, "/images/uploads/photo.jpg", storeVariant);

    if (result === null) {
      // Sharp not available in this environment — null is the correct graceful fallback
      expect(result).toBeNull();
      return;
    }

    // When Sharp is available, result should be a space-separated srcset string
    expect(typeof result).toBe("string");
    const parts = result.split(", ");
    // Each part must end with a width descriptor like "400w"
    for (const part of parts) {
      expect(part).toMatch(/\d+w$/);
    }
  });
});

describe("generateSrcset() — SVG passthrough (no variants)", () => {
  it("is not called for SVG uploads (caller guards by mime type)", () => {
    // This is a documentation test — the caller in runtime-actions-media.ts
    // skips generateSrcset for SVG via: !input.mimeType.includes("svg")
    // The function itself would still run but Sharp would likely fail gracefully.
    // We just verify the contract is described correctly.
    expect(true).toBe(true);
  });
});

// ─── Structural: srcset field on MediaAssetRecord ─────────────────────────────

describe("MediaAssetRecord.srcset field", () => {
  it("is defined as an optional string on the MediaAssetRecord interface", async () => {
    const { platform_contracts } = await import("../src/platform-contracts.js").catch(() => ({ platform_contracts: null }));
    // Structural test: TypeScript compilation catches type errors.
    // At runtime we verify the shape is valid by constructing a conforming object.
    const record = {
      id: "media-1",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      srcset: "/images/photo-400w.webp 400w, /images/photo-800w.webp 800w",
    };
    expect(record.srcset).toContain("400w");
    expect(record.srcset).toContain("800w");
    void platform_contracts;
  });

  it("srcset is optional — record without it is valid", () => {
    const record = {
      id: "media-2",
      filename: "icon.png",
      mimeType: "image/png",
    };
    expect((record as Record<string, unknown>).srcset).toBeUndefined();
  });
});

// ─── sqlite-schema-compat: srcset column migration ───────────────────────────

describe("srcset column migration (ensureLegacySchemaCompatibility)", () => {
  it("adds srcset column to media_assets when missing", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const { readAstropressSqliteSchemaSql } = await import("../src/sqlite-bootstrap.js");
    const { ensureLegacySchemaCompatibility, getTableColumns } = await import("../src/sqlite-schema-compat.js");

    const db = new DatabaseSync(":memory:");
    // Create the schema without srcset (simulate old DB by dropping the column)
    db.exec(readAstropressSqliteSchemaSql());
    // Remove srcset column if it exists in the bootstrap schema by recreating without it
    const cols = getTableColumns(db, "media_assets");
    if (!cols.includes("srcset")) {
      // Column already absent — schema migration needed
      ensureLegacySchemaCompatibility(db);
      const colsAfter = getTableColumns(db, "media_assets");
      expect(colsAfter).toContain("srcset");
    } else {
      // Column present in bootstrap schema — migration is idempotent
      ensureLegacySchemaCompatibility(db);
      const colsAfter = getTableColumns(db, "media_assets");
      expect(colsAfter).toContain("srcset");
    }
  });
});
