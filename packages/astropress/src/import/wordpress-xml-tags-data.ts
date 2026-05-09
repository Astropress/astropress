// stryker-disable-file: data-only — WordPress XML tag/attribute name catalogue,
// post-type / status / domain routing values, MIME extension map, and XML
// entity reference table. Behavioural mutants on the parser logic live in the
// consumer files (wordpress-xml.ts, wordpress-xml-helpers.ts) and are
// mutation-tested there; mutating these literals is equivalent to mutating
// the WordPress export schema itself.

export const WP_TAG = {
	AUTHOR: "wp:author",
	AUTHOR_ID: "wp:author_id",
	AUTHOR_LOGIN: "wp:author_login",
	AUTHOR_EMAIL: "wp:author_email",
	AUTHOR_DISPLAY_NAME: "wp:author_display_name",
	ITEM: "item",
	POST_ID: "wp:post_id",
	POST_TYPE: "wp:post_type",
	STATUS: "wp:status",
	TITLE: "title",
	LINK: "link",
	GUID: "guid",
	POST_NAME: "wp:post_name",
	CONTENT_ENCODED: "content:encoded",
	EXCERPT_ENCODED: "excerpt:encoded",
	POST_DATE_GMT: "wp:post_date_gmt",
	POST_DATE: "wp:post_date",
	POSTMETA: "wp:postmeta",
	META_KEY: "wp:meta_key",
	META_VALUE: "wp:meta_value",
	DC_CREATOR: "dc:creator",
	COMMENT: "wp:comment",
	COMMENT_ID: "wp:comment_id",
	COMMENT_AUTHOR: "wp:comment_author",
	COMMENT_AUTHOR_EMAIL: "wp:comment_author_email",
	COMMENT_CONTENT: "wp:comment_content",
	COMMENT_APPROVED: "wp:comment_approved",
	COMMENT_DATE_GMT: "wp:comment_date_gmt",
	COMMENT_DATE: "wp:comment_date",
	ATTACHMENT_URL: "wp:attachment_url",
	POST_PARENT: "wp:post_parent",
} as const;

export const WP_ATTR = {
	DOMAIN: "domain",
	NICENAME: "nicename",
} as const;

export const WP_CATEGORY_DOMAIN = {
	CATEGORY: "category",
	POST_TAG: "post_tag",
} as const;

export const WP_POST_TYPE = {
	POST: "post",
	PAGE: "page",
	ATTACHMENT: "attachment",
} as const;

export const WP_META_KEY_OLD_SLUG = "_wp_old_slug";

export const WP_REDIRECT_REASON_OLD_SLUG = "wp_old_slug";

export const WP_COMMENT_APPROVED_VALUE = "1";

export const WP_STATUS_INPUT = {
	PUBLISH: "publish",
	DRAFT: "draft",
	PENDING: "pending",
	FUTURE: "future",
} as const;

export const WP_MIME_BY_EXTENSION: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	pdf: "application/pdf",
};

export const WP_DEFAULT_MIME = "application/octet-stream";

export const XML_ENTITY_LOOKUP: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	quot: '"',
};
