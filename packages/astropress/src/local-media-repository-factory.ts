import { createLocalMediaUpload, deleteLocalMediaUpload } from "./local-media-storage";
import type { LocalMediaDescriptor } from "./local-media-storage";
import type { MediaRepository, SessionUser } from "./persistence-types";

export type AstropressLocalMediaRepositoryOptions = {
  listMediaAssets: MediaRepository["listMediaAssets"];
  updateMediaAsset: MediaRepository["updateMediaAsset"];
  insertStoredMediaAsset(input: { asset: LocalMediaDescriptor; actor: SessionUser }): void;
  getStoredMediaDeletionCandidate(id: string): { localPath: string } | null | undefined;
  markStoredMediaDeleted(id: string): boolean;
  recordMediaAudit(input: {
    actor: SessionUser;
    action: "media.upload" | "media.delete";
    summary: string;
    targetId: string;
  }): void;
};

export function createAstropressLocalMediaRepository(
  options: AstropressLocalMediaRepositoryOptions,
): MediaRepository {
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

      return { ok: true as const, id: stored.asset.id };
    },
    deleteMediaAsset(id, actor) {
      const assetId = id.trim();
      if (!assetId) {
        return { ok: false as const, error: "Media asset id is required." };
      }

      const row = options.getStoredMediaDeletionCandidate(assetId);
      if (!row) {
        return { ok: false as const, error: "The selected media asset could not be deleted." };
      }

      const deleted = options.markStoredMediaDeleted(assetId);
      if (!deleted) {
        return { ok: false as const, error: "The selected media asset could not be deleted." };
      }

      deleteLocalMediaUpload(row.localPath);
      options.recordMediaAudit({
        actor,
        action: "media.delete",
        summary: `Deleted media asset ${assetId}.`,
        targetId: assetId,
      });

      return { ok: true as const };
    },
  };
}
