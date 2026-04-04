import { createLocalMediaUpload, deleteLocalMediaUpload } from "./local-media-storage.js";

export function createAstropressLocalMediaRepository(options) {
  return {
    listMediaAssets: (...args) => options.listMediaAssets(...args),
    updateMediaAsset: (...args) => options.updateMediaAsset(...args),
    createMediaAsset(input, actor) {
      const stored = createLocalMediaUpload(input);
      if (!stored.ok) {
        return stored;
      }

      options.insertStoredMediaAsset({ asset: stored.asset, actor });
      options.recordMediaAudit({
        actor,
        action: "media.upload",
        summary: `Uploaded media asset ${stored.asset.storedFilename}.`,
        targetId: stored.asset.id,
      });

      return { ok: true, id: stored.asset.id };
    },
    deleteMediaAsset(id, actor) {
      const assetId = id.trim();
      if (!assetId) {
        return { ok: false, error: "Media asset id is required." };
      }

      const row = options.getStoredMediaDeletionCandidate(assetId);
      if (!row) {
        return { ok: false, error: "The selected media asset could not be deleted." };
      }

      const deleted = options.markStoredMediaDeleted(assetId);
      if (!deleted) {
        return { ok: false, error: "The selected media asset could not be deleted." };
      }

      deleteLocalMediaUpload(row.localPath);
      options.recordMediaAudit({
        actor,
        action: "media.delete",
        summary: `Deleted media asset ${assetId}.`,
        targetId: assetId,
      });

      return { ok: true };
    },
  };
}
