import { deleteRuntimeMediaObject, storeRuntimeMediaObject } from "./runtime-media-storage";
import type { Actor } from "./persistence-types";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { recordD1Audit } from "./d1-audit";
import { peekCmsConfig, dispatchPluginMediaEvent } from "./config";

/**
 * Detect pixel dimensions of an image buffer using the `image-size` package
 * (no native deps — pure JavaScript, works in CF Workers). Returns null when
 * the format is not recognised or the package is unavailable.
 */
async function detectImageDimensions(
  bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
  try {
    const { imageSize } = await import("image-size");
    // image-size accepts Buffer / Uint8Array
    const result = imageSize(Buffer.from(bytes));
    if (result.width && result.height) {
      return { width: result.width, height: result.height };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a 400px-wide WebP thumbnail using Sharp when it is available
 * (Sharp has native bindings so it fails silently in CF Workers or test envs).
 * Returns null when Sharp is unavailable or the image is already ≤400px wide.
 */
async function generateThumbnail(
  bytes: Uint8Array,
  width: number,
): Promise<Uint8Array | null> {
  if (width <= 400) return null;
  try {
    const sharp = (await import("sharp")).default;
    const output = await sharp(Buffer.from(bytes)).resize({ width: 400 }).webp().toBuffer();
    return new Uint8Array(output);
  } catch {
    return null;
  }
}

export async function updateRuntimeMediaAsset(
  input: {
    id: string;
    title?: string;
    altText?: string;
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const id = input.id.trim();
      if (!id) {
        return { ok: false as const, error: "Media asset id is required." };
      }

      const existing = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1")
        .bind(id)
        .first<{ id: string }>();

      if (!existing) {
        return { ok: false as const, error: "The selected media asset could not be updated." };
      }

      await db
        .prepare("UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL")
        .bind(input.title?.trim() ?? "", input.altText?.trim() ?? "", id)
        .run();

      await recordD1Audit(locals, actor, "media.update", "content", id, `Updated media metadata for ${id}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.updateMediaAsset(input, actor),
  );
}

export async function createRuntimeMediaAsset(
  input: {
    filename: string;
    bytes: Uint8Array;
    mimeType: string;
    title?: string;
    altText?: string;
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const maxUploadBytes = peekCmsConfig()?.maxUploadBytes ?? 10 * 1024 * 1024;
  if (input.bytes.length > maxUploadBytes) {
    const limitMib = (maxUploadBytes / (1024 * 1024)).toFixed(1);
    return { ok: false as const, error: `File too large — maximum upload size is ${limitMib} MiB` };
  }

  // Detect image dimensions for image uploads (MIME type starts with "image/")
  let imageDimensions: { width: number; height: number } | null = null;
  let thumbnailUrl: string | null = null;

  if (input.mimeType.startsWith("image/")) {
    imageDimensions = await detectImageDimensions(input.bytes);
  }

  return withLocalStoreFallback(
    locals,
    async (db) => {
      const stored = await storeRuntimeMediaObject(input, locals);
      if (!stored.ok) {
        return stored;
      }

      // Generate and store thumbnail for large images when Sharp is available
      if (imageDimensions && imageDimensions.width > 400) {
        const thumbBytes = await generateThumbnail(input.bytes, imageDimensions.width);
        if (thumbBytes) {
          const basename = stored.asset.storedFilename.replace(/\.[^.]+$/, "");
          const thumbFilename = `${basename}-thumb.webp`;
          const thumbStored = await storeRuntimeMediaObject(
            { ...input, filename: thumbFilename, bytes: thumbBytes, mimeType: "image/webp" },
            locals,
          );
          if (thumbStored.ok) {
            thumbnailUrl = thumbStored.asset.publicPath ?? null;
          }
        }
      }

      // Generate responsive srcset variants (400w, 800w, 1200w WebP) for image uploads
      let srcset: string | null = null;
      if (imageDimensions && input.mimeType.startsWith("image/") && !input.mimeType.includes("svg")) {
        const { generateSrcset } = await import("./local-image-storage.js");
        srcset = await generateSrcset(input.bytes, stored.asset.publicPath, async (variantFilename, variantBytes) => {
          const variantStored = await storeRuntimeMediaObject(
            { ...input, filename: variantFilename, bytes: variantBytes, mimeType: "image/webp" },
            locals,
          );
          return variantStored.ok ? (variantStored.asset.publicPath ?? null) : null;
        });
      }

      await db
        .prepare(
          `
            INSERT INTO media_assets (
              id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by,
              width, height, thumbnail_url, srcset
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          stored.asset.id,
          null,
          stored.asset.publicPath,
          stored.asset.r2Key,
          stored.asset.mimeType,
          stored.asset.fileSize,
          stored.asset.altText,
          stored.asset.title,
          actor.email,
          imageDimensions?.width ?? null,
          imageDimensions?.height ?? null,
          thumbnailUrl,
          srcset,
        )
        .run();

      await recordD1Audit(locals, actor, "media.upload", "content", stored.asset.id, `Uploaded media asset ${stored.asset.storedFilename}.`);
      await dispatchPluginMediaEvent({
        id: stored.asset.id,
        filename: input.filename,
        mimeType: stored.asset.mimeType,
        size: stored.asset.fileSize,
        actor: actor.email,
      });
      return {
        ok: true as const,
        id: stored.asset.id,
        width: imageDimensions?.width ?? undefined,
        height: imageDimensions?.height ?? undefined,
        thumbnailUrl: thumbnailUrl ?? undefined,
        srcset: srcset ?? undefined,
      };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createMediaAsset(input, actor),
  );
}

export async function deleteRuntimeMediaAsset(id: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const assetId = id.trim();
      if (!assetId) {
        return { ok: false as const, error: "Media asset id is required." };
      }

      const existing = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1")
        .bind(assetId)
        .first<{ id: string }>();

      if (!existing) {
        return { ok: false as const, error: "The selected media asset could not be deleted." };
      }

      await db.prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(assetId).run();
      const row = await db
        .prepare("SELECT local_path, r2_key FROM media_assets WHERE id = ? LIMIT 1")
        .bind(assetId)
        .first<{ local_path: string | null; r2_key: string | null }>();
      await deleteRuntimeMediaObject(
        {
          localPath: row?.local_path,
          r2Key: row?.r2_key,
        },
        locals,
      );

      await recordD1Audit(locals, actor, "media.delete", "content", assetId, `Deleted media asset ${assetId}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.deleteMediaAsset(id, actor),
  );
}
