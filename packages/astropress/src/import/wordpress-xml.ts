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
import {
	WP_ATTR,
	WP_CATEGORY_DOMAIN,
	WP_COMMENT_APPROVED_VALUE,
	WP_META_KEY_OLD_SLUG,
	WP_POST_TYPE,
	WP_REDIRECT_REASON_OLD_SLUG,
	WP_TAG,
} from "./wordpress-xml-tags-data";

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
	const builderMatches = countMatches(source, /(elementor|vc_row|wp-block-|et_pb_|fusion_)/gi);
	const unsupportedPatterns: string[] = [];
	const warnings: string[] = [];

	if (shortcodeMatches > 0) {
		unsupportedPatterns.push("shortcodes");
		warnings.push("WordPress shortcodes were detected; staged content will need manual review.");
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
	const authors: ParsedAuthor[] = getBlocks(source, WP_TAG.AUTHOR).map((block, index) => ({
		id: getTagText(block, WP_TAG.AUTHOR_ID) || `author-${index + 1}`,
		login: normalizeSlug(getTagText(block, WP_TAG.AUTHOR_LOGIN), `author-${index + 1}`),
		email: getTagText(block, WP_TAG.AUTHOR_EMAIL) || undefined,
		displayName:
			getTagText(block, WP_TAG.AUTHOR_DISPLAY_NAME) ||
			getTagText(block, WP_TAG.AUTHOR_LOGIN) ||
			`Author ${index + 1}`,
	}));

	const termsByKey = new Map<string, ParsedTerm>();
	const contentRecords: ParsedContentRecord[] = [];
	const mediaAssets: ParsedMediaAsset[] = [];
	const comments: ParsedComment[] = [];
	const redirects: ParsedRedirect[] = [];
	let skipped = 0;

	for (const [index, item] of getBlocks(source, WP_TAG.ITEM).entries()) {
		const legacyId = getTagText(item, WP_TAG.POST_ID) || `item-${index + 1}`;
		const postType = getTagText(item, WP_TAG.POST_TYPE).toLowerCase();
		const postStatus = normalizeContentStatus(getTagText(item, WP_TAG.STATUS));
		const title = getTagText(item, WP_TAG.TITLE) || `Untitled ${legacyId}`;
		const legacyUrl = normalizePathname(
			getTagText(item, WP_TAG.LINK) || getTagText(item, WP_TAG.GUID),
			normalizeSlug(getTagText(item, WP_TAG.POST_NAME), legacyId),
		);
		const slug = normalizeSlug(
			getTagText(item, WP_TAG.POST_NAME),
			legacyUrl
				.replace(/^\/|\/$/g, "")
				.split("/")
				.at(-1) || legacyId,
		);
		const body = getTagText(item, WP_TAG.CONTENT_ENCODED);
		const excerpt = getTagText(item, WP_TAG.EXCERPT_ENCODED);
		const publishedAt =
			getTagText(item, WP_TAG.POST_DATE_GMT) || getTagText(item, WP_TAG.POST_DATE) || undefined;

		const oldSlugs = getBlocks(item, WP_TAG.POSTMETA)
			.filter((meta) => getTagText(meta, WP_TAG.META_KEY) === WP_META_KEY_OLD_SLUG)
			.map((meta) => normalizeSlug(getTagText(meta, WP_TAG.META_VALUE), "legacy"));

		const categorySlugs: string[] = [];
		const tagSlugs: string[] = [];
		for (const category of parseCategoryBlocks(item)) {
			const domain = getAttributeValue(category.attributes, WP_ATTR.DOMAIN);
			const slugValue = normalizeSlug(
				getAttributeValue(category.attributes, WP_ATTR.NICENAME),
				normalizeSlug(category.value, "term"),
			);
			if (domain === WP_CATEGORY_DOMAIN.CATEGORY) {
				categorySlugs.push(slugValue);
				termsByKey.set(`category:${slugValue}`, {
					kind: "category",
					slug: slugValue,
					name: category.value || slugValue,
				});
			} else if (domain === WP_CATEGORY_DOMAIN.POST_TAG) {
				tagSlugs.push(slugValue);
				termsByKey.set(`tag:${slugValue}`, {
					kind: "tag",
					slug: slugValue,
					name: category.value || slugValue,
				});
			}
		}

		if (postType === WP_POST_TYPE.POST || postType === WP_POST_TYPE.PAGE) {
			const creatorLogin = getTagText(item, WP_TAG.DC_CREATOR);
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
				const sourcePath = legacyUrl.replace(new RegExp(`${escapeRegExp(slug)}/?$`), `${oldSlug}/`);
				if (sourcePath !== targetPath) {
					redirects.push({
						id: `redirect-${legacyId}-${oldSlug}`,
						sourcePath,
						targetPath,
						reason: WP_REDIRECT_REASON_OLD_SLUG,
						recordId: `${postType}-${legacyId}`,
					});
				}
			}

			for (const [commentIndex, commentBlock] of getBlocks(item, WP_TAG.COMMENT).entries()) {
				comments.push({
					id: `comment-${legacyId}-${commentIndex + 1}`,
					legacyId:
						getTagText(commentBlock, WP_TAG.COMMENT_ID) || `${legacyId}-${commentIndex + 1}`,
					recordId: `${postType}-${legacyId}`,
					authorName: getTagText(commentBlock, WP_TAG.COMMENT_AUTHOR) || "Anonymous",
					authorEmail: getTagText(commentBlock, WP_TAG.COMMENT_AUTHOR_EMAIL) || undefined,
					body: getTagText(commentBlock, WP_TAG.COMMENT_CONTENT),
					status:
						getTagText(commentBlock, WP_TAG.COMMENT_APPROVED) === WP_COMMENT_APPROVED_VALUE
							? "approved"
							: "pending",
					createdAt:
						getTagText(commentBlock, WP_TAG.COMMENT_DATE_GMT) ||
						getTagText(commentBlock, WP_TAG.COMMENT_DATE) ||
						undefined,
				});
			}
			continue;
		}

		if (postType === WP_POST_TYPE.ATTACHMENT) {
			const sourceUrl = getTagText(item, WP_TAG.ATTACHMENT_URL) || getTagText(item, WP_TAG.GUID);
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
				parentLegacyId: getTagText(item, WP_TAG.POST_PARENT) || undefined,
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
			categories: [...termsByKey.values()].filter((t) => t.kind === "category").length,
			tags: [...termsByKey.values()].filter((t) => t.kind === "tag").length,
			skipped,
		},
		remediationCandidates,
		unsupportedPatterns: unsupported.unsupportedPatterns,
		warnings: unsupported.warnings,
	};
}
