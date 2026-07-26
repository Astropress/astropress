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

	it("upload audit summary contains 'Uploaded media asset <storedFilename>.' (pins L35 template)", () => {
		const insertStoredMediaAsset = vi.fn();
		const recordMediaAudit = vi.fn();
		const repository = createAstropressLocalMediaRepository({
			listMediaAssets: vi.fn(() => []),
			updateMediaAsset: vi.fn(() => ({ ok: true })),
			insertStoredMediaAsset,
			getStoredMediaDeletionCandidate: vi.fn(),
			markStoredMediaDeleted: vi.fn(),
			recordMediaAudit,
		});
		repository.createMediaAsset(
			{
				filename: "test.png",
				bytes: new Uint8Array([1, 2, 3]),
				mimeType: "image/png",
			},
			{ email: "e@x.com", name: "E", role: "editor" },
		);
		const call = recordMediaAudit.mock.calls[0]?.[0] as { summary: string };
		expect(call.summary).toBe("Uploaded media asset media-test-uuid.");
	});

	it("deleteMediaAsset returns ok:false with the 'could not be deleted' error when row is missing (pins L48 !row + L51 error message)", () => {
		const markStoredMediaDeleted = vi.fn();
		const recordMediaAudit = vi.fn();
		const repository = createAstropressLocalMediaRepository({
			listMediaAssets: vi.fn(() => []),
			updateMediaAsset: vi.fn(() => ({ ok: true })),
			insertStoredMediaAsset: vi.fn(),
			getStoredMediaDeletionCandidate: vi.fn(() => null),
			markStoredMediaDeleted,
			recordMediaAudit,
		});
		const result = repository.deleteMediaAsset("missing-id", {
			email: "e@x.com",
			name: "E",
			role: "editor",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("The selected media asset could not be deleted.");
		}
		// Mutating `if (!row)` to `if (false)` (or emptying its block) would skip
		// the early-return and continue into markStoredMediaDeleted + audit. The
		// observable error message happens to match the L56 path, so we must
		// pin the side-effects: neither markStoredMediaDeleted nor recordMediaAudit
		// should fire when the row is missing.
		expect(markStoredMediaDeleted).not.toHaveBeenCalled();
		expect(recordMediaAudit).not.toHaveBeenCalled();
	});

	it("delete audit summary contains 'Deleted media asset <assetId>.' (pins L67 StringLiteral)", () => {
		const recordMediaAudit = vi.fn();
		const repository = createAstropressLocalMediaRepository({
			listMediaAssets: vi.fn(() => []),
			updateMediaAsset: vi.fn(() => ({ ok: true })),
			insertStoredMediaAsset: vi.fn(),
			getStoredMediaDeletionCandidate: vi.fn(() => ({ localPath: "/some/path" })),
			markStoredMediaDeleted: vi.fn(() => true),
			recordMediaAudit,
		});
		repository.deleteMediaAsset("asset-123", {
			email: "e@x.com",
			name: "E",
			role: "editor",
		});
		const deleteCall = recordMediaAudit.mock.calls.find(
			(args) => (args[0] as { action: string }).action === "media.delete",
		);
		expect((deleteCall![0] as { summary: string }).summary).toBe("Deleted media asset asset-123.");
	});

	it("deleteMediaAsset returns ok:false when markStoredMediaDeleted returns false (pins L56 !deleted + L59 error message)", () => {
		const repository = createAstropressLocalMediaRepository({
			listMediaAssets: vi.fn(() => []),
			updateMediaAsset: vi.fn(() => ({ ok: true })),
			insertStoredMediaAsset: vi.fn(),
			getStoredMediaDeletionCandidate: vi.fn(() => ({ localPath: "/some/path" })),
			markStoredMediaDeleted: vi.fn(() => false),
			recordMediaAudit: vi.fn(),
		});
		const result = repository.deleteMediaAsset("found-id", {
			email: "e@x.com",
			name: "E",
			role: "editor",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("The selected media asset could not be deleted.");
		}
	});
});
