import { describe, expect, it, vi } from "vitest";
import { createAstropressLocalMediaRepository } from "../src/local-media-repository-factory";

describe("local media repository factory", () => {
	it("creates and deletes local media through package-owned storage helpers", () => {
		const insertStoredMediaAsset = vi.fn();
		const getStoredMediaDeletionCandidate = vi.fn(() => ({
			localPath: "/images/uploads/test.png",
		}));
		const markStoredMediaDeleted = vi.fn(() => true);
		const recordMediaAudit = vi.fn();

		const repository = createAstropressLocalMediaRepository({
			listMediaAssets: vi.fn(() => []),
			updateMediaAsset: vi.fn(() => ({ ok: true })),
			insertStoredMediaAsset,
			getStoredMediaDeletionCandidate,
			markStoredMediaDeleted,
			recordMediaAudit,
		});

		const upload = repository.createMediaAsset(
			{
				filename: "test.png",
				bytes: new Uint8Array([1, 2, 3]),
				mimeType: "image/png",
				title: "Test",
				altText: "Alt",
			},
			{ email: "editor@example.com", name: "Editor", role: "editor" },
		);

		expect(upload.ok).toBe(true);
		if (!upload.ok) {
			return;
		}

		expect(insertStoredMediaAsset).toHaveBeenCalledTimes(1);
		expect(recordMediaAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "media.upload",
				targetId: upload.id,
			}),
		);

		const deletion = repository.deleteMediaAsset(upload.id, {
			email: "editor@example.com",
			name: "Editor",
			role: "editor",
		});

		expect(deletion).toEqual({ ok: true });
		expect(getStoredMediaDeletionCandidate).toHaveBeenCalledWith(upload.id);
		expect(markStoredMediaDeleted).toHaveBeenCalledWith(upload.id);
		expect(recordMediaAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "media.delete",
				targetId: upload.id,
			}),
		);
	});
});
