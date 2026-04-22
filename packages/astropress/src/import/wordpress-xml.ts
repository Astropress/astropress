import type { AstropressWordPressImportEntityCount } from "../platform-contracts";
import {
	countMatches,
	escapeRegExp,
	filenameFromUrl,
	getAttributeValue,
	getBlocks,
	getTagText,
	inferMimeType,
	normalizeContentStatus,
	normalizePathname,
	normalizeSlug,
	parseCategoryBlocks,
	safeArtifactFilename,
} from "./wordpress-xml-helpers";

export type ParsedAuthor = {
	id: string;
	login: string;
	email?: string;
	displayName: string;
};

export type ParsedTerm = {
	kind: "category" | "tag";
	slug: string;
	name: string;
};

export type ParsedRedirect = {
	id: string;
	sourcePath: string;
	targetPath: string;
	reason: string;
	recordId: string;
};

export type ParsedComment = {
	id: string;
	legacyId: string;
	recordId: string;
	authorName: string;
	authorEmail?: string;
	body: string;
	status: "approved" | "pending";
	createdAt?: string;
};

export type ParsedContentRecord = {
	id: string;
	legacyId: string;
	kind: "post" | "page";
	slug: string;
	title: string;
	body: string;
	excerpt?: string;
	status: "draft" | "published" | "archived";
	legacyUrl: string;
	publishedAt?: string;
	authorLogins: string[];
	categorySlugs: string[];
	tagSlugs: string[];
	oldSlugs: string[];
};

export type ParsedMediaAsset = {
	id: string;
	legacyId: string;
	slug: string;
	title: string;
	sourceUrl: string;
	legacyUrl: string;
	filename: string;
	mimeType: string;
	parentLegacyId?: string;
};

export type ParsedBundle = {
	authors: ParsedAuthor[];
	terms: ParsedTerm[];
	contentRecords: ParsedContentRecord[];
	mediaAssets: ParsedMediaAsset[];
	comments: ParsedComment[];
	redirects: ParsedRedirect[];
	entityCounts: AstropressWordPressImportEntityCount;
	remediationCandidates: string[];
	unsupportedPatterns: string[];
	warnings: string[];
};

export function detectUnsupportedPatterns(source: string) {
	const shortcodeMatches = countMatches(source, /\[[a-z][^\]]*\]/gi);
	const builderMatches = countMatches(
		source,
		/(elementor|vc_row|wp-block-|et_pb_|fusion_)/gi,
	);
	const unsupportedPatterns: string[] = [];
	const warnings: string[] = [];

	if (shortcodeMatches > 0) {
		unsupportedPatterns.push("shortcodes");
		warnings.push(
			"WordPress shortcodes were detected; staged content will need manual review.",
		);
	}
	if (builderMatches > 0) {
		unsupportedPatterns.push("page-builder-markup");
		warnings.push(
			"WordPress page-builder markup was detected; staged content will need manual cleanup.",
		);
	}

	return { shortcodeMatches, builderMatches, unsupportedPatterns, warnings };
}

export function parseWordPressExport(source: string): ParsedBundle {
	const authors: ParsedAuthor[] = getBlocks(source, "wp:author").map(
		(block, index) => ({
			id: getTagText(block, "wp:author_id") || `author-${index + 1}`,
			login: normalizeSlug(
				getTagText(block, "wp:author_login"),
				`author-${index + 1}`,
			),
			email: getTagText(block, "wp:author_email") || undefined,
			displayName:
				getTagText(block, "wp:author_display_name") ||
				getTagText(block, "wp:author_login") ||
				`Author ${index + 1}`,
		}),
	);

	const termsByKey = new Map<string, ParsedTerm>();
	const contentRecords: ParsedContentRecord[] = [];
	const mediaAssets: ParsedMediaAsset[] = [];
	const comments: ParsedComment[] = [];
	const redirects: ParsedRedirect[] = [];
	let skipped = 0;

	for (const [index, item] of getBlocks(source, "item").entries()) {
		const legacyId = getTagText(item, "wp:post_id") || `item-${index + 1}`;
		const postType = getTagText(item, "wp:post_type").toLowerCase();
		const postStatus = normalizeContentStatus(getTagText(item, "wp:status"));
		const title = getTagText(item, "title") || `Untitled ${legacyId}`;
		const legacyUrl = normalizePathname(
			getTagText(item, "link") || getTagText(item, "guid"),
			normalizeSlug(getTagText(item, "wp:post_name"), legacyId),
		);
		const slug = normalizeSlug(
			getTagText(item, "wp:post_name"),
			legacyUrl
				.replace(/^\/|\/$/g, "")
				.split("/")
				.at(-1) || legacyId,
		);
		const body = getTagText(item, "content:encoded");
		const excerpt = getTagText(item, "excerpt:encoded");
		const publishedAt =
			getTagText(item, "wp:post_date_gmt") ||
			getTagText(item, "wp:post_date") ||
			undefined;

		const oldSlugs = getBlocks(item, "wp:postmeta")
			.filter((meta) => getTagText(meta, "wp:meta_key") === "_wp_old_slug")
			.map((meta) =>
				normalizeSlug(getTagText(meta, "wp:meta_value"), "legacy"),
			);

		const categorySlugs: string[] = [];
		const tagSlugs: string[] = [];
		for (const category of parseCategoryBlocks(item)) {
			const domain = getAttributeValue(category.attributes, "domain");
			const slugValue = normalizeSlug(
				getAttributeValue(category.attributes, "nicename"),
				normalizeSlug(category.value, "term"),
			);
			if (domain === "category") {
				categorySlugs.push(slugValue);
				termsByKey.set(`category:${slugValue}`, {
					kind: "category",
					slug: slugValue,
					name: category.value || slugValue,
				});
			} else if (domain === "post_tag") {
				tagSlugs.push(slugValue);
				termsByKey.set(`tag:${slugValue}`, {
					kind: "tag",
					slug: slugValue,
					name: category.value || slugValue,
				});
			}
		}

		if (postType === "post" || postType === "page") {
			const creatorLogin = getTagText(item, "dc:creator");
			const matchedAuthor = creatorLogin
				? authors.find((a) => a.login === creatorLogin)
				: undefined;
			const authorLogins = matchedAuthor
				? [matchedAuthor.login]
				: authors.length > 0
					? [authors[0]?.login]
					: [];

			contentRecords.push({
				id: `${postType}-${legacyId}`,
				legacyId,
				kind: postType,
				slug,
				title,
				body,
				excerpt: excerpt || undefined,
				status: postStatus,
				legacyUrl,
				publishedAt,
				authorLogins,
				categorySlugs,
				tagSlugs,
				oldSlugs,
			});

			for (const oldSlug of oldSlugs) {
				const targetPath = legacyUrl;
				const sourcePath = legacyUrl.replace(
					new RegExp(`${escapeRegExp(slug)}/?$`),
					`${oldSlug}/`,
				);
				if (sourcePath !== targetPath) {
					redirects.push({
						id: `redirect-${legacyId}-${oldSlug}`,
						sourcePath,
						targetPath,
						reason: "wp_old_slug",
						recordId: `${postType}-${legacyId}`,
					});
				}
			}

			for (const [commentIndex, commentBlock] of getBlocks(
				item,
				"wp:comment",
			).entries()) {
				comments.push({
					id: `comment-${legacyId}-${commentIndex + 1}`,
					legacyId:
						getTagText(commentBlock, "wp:comment_id") ||
						`${legacyId}-${commentIndex + 1}`,
					recordId: `${postType}-${legacyId}`,
					authorName:
						getTagText(commentBlock, "wp:comment_author") || "Anonymous",
					authorEmail:
						getTagText(commentBlock, "wp:comment_author_email") || undefined,
					body: getTagText(commentBlock, "wp:comment_content"),
					status:
						getTagText(commentBlock, "wp:comment_approved") === "1"
							? "approved"
							: "pending",
					createdAt:
						getTagText(commentBlock, "wp:comment_date_gmt") ||
						getTagText(commentBlock, "wp:comment_date") ||
						undefined,
				});
			}
			continue;
		}

		if (postType === "attachment") {
			const sourceUrl =
				getTagText(item, "wp:attachment_url") || getTagText(item, "guid");
			const filename = safeArtifactFilename(
				filenameFromUrl(sourceUrl, `${slug || legacyId}.bin`),
				`${slug || legacyId}.bin`,
			);
			mediaAssets.push({
				id: `media-${legacyId}`,
				legacyId,
				slug,
				title,
				sourceUrl,
				legacyUrl,
				filename,
				mimeType: inferMimeType(filename),
				parentLegacyId: getTagText(item, "wp:post_parent") || undefined,
			});
			continue;
		}

		skipped += 1;
	}

	const unsupported = detectUnsupportedPatterns(
		contentRecords.map((r) => `${r.body}\n${r.excerpt ?? ""}`).join("\n"),
	);
	const remediationCandidates = contentRecords
		.filter((r) =>
			/\[[a-z][^\]]*\]|elementor|vc_row|wp-block-|et_pb_|fusion_/i.test(
				`${r.body}\n${r.excerpt ?? ""}`,
			),
		)
		.map((r) => r.id);

	return {
		authors,
		terms: [...termsByKey.values()],
		contentRecords,
		mediaAssets,
		comments,
		redirects,
		entityCounts: {
			posts: contentRecords.filter((r) => r.kind === "post").length,
			pages: contentRecords.filter((r) => r.kind === "page").length,
			attachments: mediaAssets.length,
			redirects: redirects.length,
			comments: comments.length,
			users: authors.length,
			categories: [...termsByKey.values()].filter((t) => t.kind === "category")
				.length,
			tags: [...termsByKey.values()].filter((t) => t.kind === "tag").length,
			skipped,
		},
		remediationCandidates,
		unsupportedPatterns: unsupported.unsupportedPatterns,
		warnings: unsupported.warnings,
	};
}
