import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyWixImportToLocalRuntime } from "./wix-apply.js";
import type { WixParsedBundle } from "./wix-apply.js";
import {
	cleanWixHtml,
	guessExtension,
	guessMimeTypeWix,
	lastPathSegment,
	normalizeWixImageUrl,
	scrapeImageUrls,
	slugify,
	splitCsvRows,
	splitTermList,
} from "./wix-csv.js";

type DownloadState = {
	completed: string[];
	failed: { id: string; sourceUrl: string; reason: string }[];
};

export function parseWixExport(csvText: string): WixParsedBundle {
	const rows = splitCsvRows(csvText);
	if (rows.length < 2) {
		return {
			authors: [],
			terms: [],
			contentRecords: [],
			mediaAssets: [],
			warnings: ["No rows found in Wix CSV export."],
		};
	}

	const headerRow = rows[0] as string[];
	const headerIndex = new Map<string, number>();
	headerRow.forEach((col, i) => headerIndex.set(col.toLowerCase().trim(), i));

	function col(row: string[], names: string[]): string {
		for (const name of names) {
			const idx = headerIndex.get(name);
			if (idx !== undefined && row[idx] !== undefined) return row[idx]?.trim();
		}
		return "";
	}

	const authorSet = new Map<string, WixParsedBundle["authors"][0]>();
	const categorySet = new Map<string, WixParsedBundle["terms"][0]>();
	const tagSet = new Map<string, WixParsedBundle["terms"][0]>();
	const mediaSet = new Map<string, WixParsedBundle["mediaAssets"][0]>();
	const contentRecords: WixParsedBundle["contentRecords"] = [];
	const warnings: string[] = [];
	let mediaIndex = 0;

	for (const row of rows.slice(1)) {
		const title = col(row, ["title"]);
		const body = col(row, ["body", "content", "richtext", "html"]);
		const isDraft = col(row, ["isdraft", "draft"]).toLowerCase() === "true";
		const status: "draft" | "published" = isDraft ? "draft" : "published";
		const authorName = col(row, ["author", "writer"]) || "Unknown";
		const authorLogin = slugify(authorName);
		const rawSlug = col(row, ["slug", "url", "posturl", "link"]);
		const slug = rawSlug
			? lastPathSegment(rawSlug) || slugify(title)
			: slugify(title);
		const legacyUrl = rawSlug || `/${slug}`;
		const publishedAt =
			col(row, ["publisheddate", "publicationdate", "published", "date"]) ||
			undefined;
		const excerpt =
			col(row, ["excerpt", "description", "summary"]) || undefined;
		const coverImageRaw = col(row, [
			"coverimage",
			"featuredimage",
			"image",
			"thumbnail",
		]);

		if (!title && !body) continue;

		if (!authorSet.has(authorLogin))
			authorSet.set(authorLogin, {
				login: authorLogin,
				displayName: authorName,
			});

		const categorySlugs: string[] = [];
		for (const cat of splitTermList(col(row, ["categories", "category"]))) {
			const catSlug = slugify(cat);
			categorySlugs.push(catSlug);
			if (!categorySet.has(catSlug))
				categorySet.set(catSlug, {
					kind: "category",
					slug: catSlug,
					name: cat,
				});
		}

		const tagSlugs: string[] = [];
		for (const tag of splitTermList(col(row, ["tags", "tag"]))) {
			const tagSlug = slugify(tag);
			tagSlugs.push(tagSlug);
			if (!tagSet.has(tagSlug))
				tagSet.set(tagSlug, { kind: "tag", slug: tagSlug, name: tag });
		}

		if (coverImageRaw) {
			const normalized = normalizeWixImageUrl(coverImageRaw);
			if (!mediaSet.has(normalized)) {
				const id = `wix-media-${mediaIndex++}`;
				const filename = `${id}${guessExtension(normalized)}`;
				mediaSet.set(normalized, {
					id,
					slug: id,
					title: title || id,
					sourceUrl: normalized,
					filename,
					mimeType: guessMimeTypeWix(normalized),
				});
			}
		}

		for (const imgUrl of scrapeImageUrls(body)) {
			const normalized = normalizeWixImageUrl(imgUrl);
			if (!mediaSet.has(normalized)) {
				const id = `wix-media-${mediaIndex++}`;
				const filename = `${id}${guessExtension(normalized)}`;
				mediaSet.set(normalized, {
					id,
					slug: id,
					title: id,
					sourceUrl: normalized,
					filename,
					mimeType: guessMimeTypeWix(normalized),
				});
			}
		}

		contentRecords.push({
			id: `wix-post-${contentRecords.length}`,
			kind: "post",
			slug,
			title,
			body: cleanWixHtml(body),
			excerpt,
			status,
			legacyUrl,
			publishedAt,
			authorLogins: [authorLogin],
			categorySlugs,
			tagSlugs,
		});
	}

	if (contentRecords.length === 0) {
		warnings.push(
			"No blog posts were found in the Wix CSV export. Only blog post exports are supported (Wix pages cannot be exported).",
		);
	}

	return {
		authors: Array.from(authorSet.values()),
		terms: [
			...Array.from(categorySet.values()),
			...Array.from(tagSet.values()),
		],
		contentRecords,
		mediaAssets: Array.from(mediaSet.values()),
		warnings,
	};
}

async function loadDownloadState(stateFile: string): Promise<DownloadState> {
	try {
		return JSON.parse(await readFile(stateFile, "utf8")) as DownloadState;
	} catch {
		return { completed: [], failed: [] };
	}
}

async function downloadWixMedia(
	assets: WixParsedBundle["mediaAssets"],
	artifactDir: string,
	resumeFrom?: string,
): Promise<{
	downloadedMedia: number;
	failedMedia: DownloadState["failed"];
	downloadStateFile: string;
}> {
	const downloadsDir = path.join(artifactDir, "downloads");
	await mkdir(downloadsDir, { recursive: true });
	const stateFile = resumeFrom ?? path.join(artifactDir, "download-state.json");
	const state = await loadDownloadState(stateFile);
	const completedSet = new Set(state.completed);
	let downloadedMedia = state.completed.length;

	for (const asset of assets) {
		if (completedSet.has(asset.id)) continue;
		try {
			const response = await fetch(asset.sourceUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			await writeFile(
				path.join(downloadsDir, path.basename(asset.filename)),
				Buffer.from(await response.arrayBuffer()), // audit-ok: path.basename() strips traversal from the HTTP-supplied filename; bytes intentionally written from the import response; codeql[js/http-to-file-access]
			);
			state.completed.push(asset.id);
			downloadedMedia++;
		} catch (err) {
			state.failed.push({
				id: asset.id,
				sourceUrl: asset.sourceUrl,
				reason: err instanceof Error ? err.message : String(err),
			});
		}
		await writeFile(stateFile, JSON.stringify(state, null, 2));
	}

	return {
		downloadedMedia,
		failedMedia: state.failed,
		downloadStateFile: stateFile,
	};
}

async function stageWixArtifacts(artifactDir: string, bundle: WixParsedBundle) {
	await mkdir(artifactDir, { recursive: true });
	const files = {
		contentFile: path.join(artifactDir, "content-records.json"),
		mediaFile: path.join(artifactDir, "media-manifest.json"),
		userFile: path.join(artifactDir, "user-records.json"),
		taxonomyFile: path.join(artifactDir, "taxonomy-records.json"),
		downloadStateFile: path.join(artifactDir, "download-state.json"),
	};
	await writeFile(
		files.contentFile,
		JSON.stringify(bundle.contentRecords, null, 2),
	);
	await writeFile(files.mediaFile, JSON.stringify(bundle.mediaAssets, null, 2));
	await writeFile(files.userFile, JSON.stringify(bundle.authors, null, 2));
	await writeFile(files.taxonomyFile, JSON.stringify(bundle.terms, null, 2));
	return files;
}

export function createAstropressWixImportSource() {
	return {
		async importWix(input: {
			exportFile: string;
			artifactDir?: string;
			downloadMedia?: boolean;
			applyLocal?: boolean;
			workspaceRoot?: string;
			adminDbPath?: string;
			resumeFrom?: string;
		}) {
			const csvText = await readFile(input.exportFile, "utf8");
			const bundle = parseWixExport(csvText);

			let artifacts: Awaited<ReturnType<typeof stageWixArtifacts>> | undefined;
			if (input.artifactDir)
				artifacts = await stageWixArtifacts(input.artifactDir, bundle);

			let downloadedMedia = 0;
			const failedMedia: DownloadState["failed"] = [];
			if (
				input.downloadMedia &&
				input.artifactDir &&
				bundle.mediaAssets.length > 0
			) {
				const dl = await downloadWixMedia(
					bundle.mediaAssets,
					input.artifactDir,
					input.resumeFrom,
				);
				downloadedMedia = dl.downloadedMedia;
				failedMedia.push(...dl.failedMedia);
			}

			let localApply:
				| Awaited<ReturnType<typeof applyWixImportToLocalRuntime>>
				| undefined;
			if (input.applyLocal && input.workspaceRoot) {
				localApply = await applyWixImportToLocalRuntime({
					bundle,
					artifactDir: input.artifactDir,
					workspaceRoot: input.workspaceRoot,
					adminDbPath: input.adminDbPath,
				});
			}

			return {
				status: failedMedia.length > 0 ? "partial" : "complete",
				imported_records: bundle.contentRecords.length,
				imported_media: bundle.mediaAssets.length,
				imported_authors: bundle.authors.length,
				downloaded_media: downloadedMedia,
				failed_media: failedMedia,
				warnings: bundle.warnings,
				artifacts: artifacts
					? {
							artifact_dir: input.artifactDir ?? null,
							content_file: artifacts.contentFile,
							media_file: artifacts.mediaFile,
							user_file: artifacts.userFile,
							taxonomy_file: artifacts.taxonomyFile,
							download_state_file: artifacts.downloadStateFile,
						}
					: null,
				local_apply: localApply
					? {
							applied_records: localApply.appliedRecords,
							applied_media: localApply.appliedMedia,
							applied_authors: localApply.appliedAuthors,
							admin_db_path: localApply.adminDbPath,
						}
					: null,
			};
		},
	};
}
