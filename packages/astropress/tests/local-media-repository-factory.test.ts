import { describe, expect, it, vi } from "vitest";
import { createAstropressLocalMediaRepository } from "../src/local-media-repository-factory";

// Mock filesystem ops — this test covers repository orchestration logic only.
// local-media-storage.test.ts covers the storage layer in isolation. Without
// this mock, isolate:false coverage runs inherit a deleted temp dir from that
// test's afterEach, causing ENOENT on the module-level uploadsDir constant.
vi.mock("../src/local-media-storage", () => ({
	createLocalMediaUpload: vi.fn(() => ({
		ok: true as const,
		asset: {
			id: "media-test-uuid",
			storedFilename: "media-test-uuid",
			diskPath: "/var/astropress-mock/media-test-uuid",
			publicPath: "/images/uploads/media-test-uuid",
			r2Key: "media/media-test-uuid",
			mimeType: "image/png",
			fileSize: 3,
			title: "Test",
			altText: "Alt",
		},
	})),
	deleteLocalMediaUpload: vi.fn(),
}));

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
