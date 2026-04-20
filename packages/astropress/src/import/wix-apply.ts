import { stat } from "node:fs/promises";
import path from "node:path";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime";
import { createDefaultAstropressSqliteSeedToolkit } from "../sqlite-bootstrap";

export type WixParsedAuthor = { login: string; displayName: string };
export type WixParsedTerm = {
	kind: "category" | "tag";
	slug: string;
	name: string;
};
export type WixParsedMediaAsset = {
	id: string;
	slug: string;
	title: string;
	sourceUrl: string;
	filename: string;
	mimeType: string;
};
export type WixParsedContentRecord = {
	id: string;
	kind: "post";
	slug: string;
	title: string;
	body: string;
	excerpt: string | undefined;
	status: "draft" | "published";
	legacyUrl: string;
	publishedAt: string | undefined;
	authorLogins: string[];
	categorySlugs: string[];
	tagSlugs: string[];
};

export type WixParsedBundle = {
	authors: WixParsedAuthor[];
	terms: WixParsedTerm[];
	contentRecords: WixParsedContentRecord[];
	mediaAssets: WixParsedMediaAsset[];
	warnings: string[];
};

const WIX_IMPORT_ACTOR = {
	email: "wix-import@astropress.local",
	role: "admin" as const,
	name: "Wix Import",
};

export async function fileSizeOrNull(
	targetPath: string,
): Promise<number | null> {
	try {
		return (await stat(targetPath)).size;
	} catch {
		return null;
	}
}

export function resolveAdminDbPath(
	workspaceRoot: string,
	adminDbPath?: string,
): string {
	if (adminDbPath)
		return path.isAbsolute(adminDbPath)
			? adminDbPath
			: path.join(workspaceRoot, adminDbPath);
	return createDefaultAstropressSqliteSeedToolkit().getDefaultAdminDbPath(
		workspaceRoot,
	);
}

type WixAdminDb = ReturnType<
	ReturnType<
		typeof createDefaultAstropressSqliteSeedToolkit
	>["openSeedDatabase"]
>;
type WixAdminRuntime = ReturnType<typeof createAstropressSqliteAdminRuntime>;

function importWixTerms(
	db: WixAdminDb,
	bundle: WixParsedBundle,
): {
	categoryIdsBySlug: Map<string, number>;
	tagIdsBySlug: Map<string, number>;
} {
	const upsertCategory = db.prepare(`
    INSERT INTO categories (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
  `);
	const upsertTag = db.prepare(`
    INSERT INTO tags (slug, name, description, deleted_at) VALUES (?, ?, ?, NULL)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
  `);
	const selectCategoryId = db.prepare(
		"SELECT id FROM categories WHERE slug = ? LIMIT 1",
	);
	const selectTagId = db.prepare("SELECT id FROM tags WHERE slug = ? LIMIT 1");
	const categoryIdsBySlug = new Map<string, number>();
	const tagIdsBySlug = new Map<string, number>();
	for (const term of bundle.terms) {
		if (term.kind === "category") {
			upsertCategory.run(term.slug, term.name, null);
			const row = selectCategoryId.get(term.slug) as { id: number } | undefined;
			if (row) categoryIdsBySlug.set(term.slug, row.id);
		} else {
			upsertTag.run(term.slug, term.name, null);
			const row = selectTagId.get(term.slug) as { id: number } | undefined;
			if (row) tagIdsBySlug.set(term.slug, row.id);
		}
	}
	return { categoryIdsBySlug, tagIdsBySlug };
}

function importWixContentRecords(
	db: WixAdminDb,
	runtime: WixAdminRuntime,
	bundle: WixParsedBundle,
	authorIdsByLogin: Map<string, number>,
	categoryIdsBySlug: Map<string, number>,
	tagIdsBySlug: Map<string, number>,
) {
	for (const record of bundle.contentRecords) {
		const authorIds = record.authorLogins
			.map((l) => authorIdsByLogin.get(l))
			.filter((v): v is number => typeof v === "number");
		const categoryIds = record.categorySlugs
			.map((s) => categoryIdsBySlug.get(s))
			.filter((v): v is number => typeof v === "number");
		const tagIds = record.tagSlugs
			.map((s) => tagIdsBySlug.get(s))
			.filter((v): v is number => typeof v === "number");
		const revisionInput = {
			title: record.title,
			status: record.status,
			body: record.body,
			seoTitle: record.title,
			metaDescription: record.excerpt ?? record.title,
			excerpt: record.excerpt,
			authorIds,
			categoryIds,
			tagIds,
			revisionNote: `Wix import ${record.id}`,
		};

		const existing = runtime.sqliteAdminStore.content.getContentState(
			record.slug,
		);
		if (existing) {
			const saved = runtime.sqliteAdminStore.content.saveContentState(
				record.slug,
				revisionInput,
				WIX_IMPORT_ACTOR,
			);
			if (!saved.ok) throw new Error(saved.error);
			db.prepare(
				"UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?",
			).run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
		} else {
			const created = runtime.sqliteAdminStore.content.createContentRecord(
				{
					title: record.title,
					slug: record.slug,
					legacyUrl: record.legacyUrl,
					body: record.body,
					summary: record.excerpt ?? "",
					status: record.status,
					seoTitle: record.title,
					metaDescription: record.excerpt ?? record.title,
					excerpt: record.excerpt,
				},
				WIX_IMPORT_ACTOR,
			);
			if (!created.ok) throw new Error(created.error);
			const saved = runtime.sqliteAdminStore.content.saveContentState(
				record.slug,
				revisionInput,
				WIX_IMPORT_ACTOR,
			);
			if (!saved.ok) throw new Error(saved.error);
			db.prepare(
				"UPDATE content_entries SET kind = ?, legacy_url = ?, summary = ? WHERE slug = ?",
			).run(record.kind, record.legacyUrl, record.excerpt ?? "", record.slug);
		}
	}
}

async function importWixMedia(
	db: WixAdminDb,
	bundle: WixParsedBundle,
	artifactDir: string | undefined,
) {
	const upsertMedia = db.prepare(`
    INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_by, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      source_url = excluded.source_url, local_path = excluded.local_path,
      mime_type = excluded.mime_type, file_size = excluded.file_size,
      title = excluded.title, uploaded_by = excluded.uploaded_by, deleted_at = NULL
  `);
	for (const asset of bundle.mediaAssets) {
		const downloadedPath = artifactDir
			? path.join(artifactDir, "downloads", path.basename(asset.filename))
			: undefined;
		const hasFile = downloadedPath
			? (await fileSizeOrNull(downloadedPath)) !== null
			: false;
		const localPath = hasFile ? (downloadedPath as string) : asset.sourceUrl;
		upsertMedia.run(
			asset.id,
			asset.sourceUrl,
			localPath,
			asset.mimeType,
			hasFile ? await fileSizeOrNull(downloadedPath as string) : null,
			"",
			asset.title,
			WIX_IMPORT_ACTOR.email,
		);
	}
}

export async function applyWixImportToLocalRuntime(input: {
	bundle: WixParsedBundle;
	artifactDir?: string;
	workspaceRoot: string;
	adminDbPath?: string;
}): Promise<{
	appliedRecords: number;
	appliedMedia: number;
	appliedAuthors: number;
	adminDbPath: string;
}> {
	const seedToolkit = createDefaultAstropressSqliteSeedToolkit();
	const resolvedDbPath = resolveAdminDbPath(
		input.workspaceRoot,
		input.adminDbPath,
	);
	seedToolkit.seedDatabase({
		dbPath: resolvedDbPath,
		workspaceRoot: input.workspaceRoot,
	});

	const db = seedToolkit.openSeedDatabase(resolvedDbPath);
	const runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => db });

	try {
		db.exec("BEGIN");

		const upsertAuthor = db.prepare(`
      INSERT INTO authors (slug, name, bio, deleted_at) VALUES (?, ?, ?, NULL)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name, bio = excluded.bio, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    `);
		const selectAuthorId = db.prepare(
			"SELECT id FROM authors WHERE slug = ? LIMIT 1",
		);
		const authorIdsByLogin = new Map<string, number>();
		for (const author of input.bundle.authors) {
			upsertAuthor.run(author.login, author.displayName, null);
			const row = selectAuthorId.get(author.login) as
				| { id: number }
				| undefined;
			if (row) authorIdsByLogin.set(author.login, row.id);
		}

		const { categoryIdsBySlug, tagIdsBySlug } = importWixTerms(
			db,
			input.bundle,
		);
		importWixContentRecords(
			db,
			runtime,
			input.bundle,
			authorIdsByLogin,
			categoryIdsBySlug,
			tagIdsBySlug,
		);
		await importWixMedia(db, input.bundle, input.artifactDir);

		db.exec("COMMIT");
		return {
			appliedRecords: input.bundle.contentRecords.length,
			appliedMedia: input.bundle.mediaAssets.length,
			appliedAuthors: input.bundle.authors.length,
			adminDbPath: resolvedDbPath,
		};
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	} finally {
		db.close();
	}
}
