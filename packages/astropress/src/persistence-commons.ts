/**
 * Shared persistence helpers consumed by both the D1 adapter
 * (packages/astropress/src/d1-*.ts) and the SQLite runtime
 * (packages/astropress/src/sqlite-runtime/*). Dialect-specific SQL stays in
 * each adapter; this module holds only dialect-independent logic.
 */

import type { ContentOverride } from "./persistence-types";

export type ContentStatus = "draft" | "review" | "published" | "archived";

// ---------------------------------------------------------------------------
// Slug / path normalization
// ---------------------------------------------------------------------------

export function normalizeSlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.split("-")
		.filter(Boolean)
		.join("-");
}

/**
 * Redirect target normalization. Rejects protocol-relative URLs (`//evil/...`)
 * — open-redirect vector — by returning an empty string.
 */
export function normalizeRedirectTarget(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("//")) return "";
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function normalizeContentStatus(input?: string | null): ContentStatus {
	if (
		input === "draft" ||
		input === "review" ||
		input === "archived" ||
		input === "published"
	) {
		return input;
	}
	return "published";
}

// ---------------------------------------------------------------------------
// ID list serialization (author_ids, category_ids, tag_ids columns)
// ---------------------------------------------------------------------------

export function parseIdList(value: string | null | undefined): number[] {
	if (!value) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed
		.map((entry) => Number(entry))
		.filter((entry) => Number.isInteger(entry) && entry > 0);
}

export function serializeIdList(values: number[]): string {
	return JSON.stringify(
		values
			.filter((entry) => Number.isInteger(entry) && entry > 0)
			.sort((a, b) => a - b),
	);
}

// ---------------------------------------------------------------------------
// Content record validation
// ---------------------------------------------------------------------------

export interface ContentRecordInput {
	slug?: unknown;
	title?: unknown;
	status?: unknown;
}

export function validateContentRecord(record: ContentRecordInput): {
	ok: boolean;
	error?: string;
} {
	if (typeof record.slug !== "string" || record.slug.trim() === "") {
		return { ok: false, error: "Content record requires a non-empty slug" };
	}
	if (typeof record.title !== "string" || record.title.trim() === "") {
		return { ok: false, error: "Content record requires a non-empty title" };
	}
	if (
		record.status !== undefined &&
		record.status !== null &&
		typeof record.status === "string" &&
		!["draft", "review", "published", "archived"].includes(record.status)
	) {
		return { ok: false, error: `Invalid content status: ${record.status}` };
	}
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit schema
// ---------------------------------------------------------------------------

/** Column list for the `audit_events` table, in insert order. */
export const auditSchemaFields = [
	"user_email",
	"action",
	"resource_type",
	"resource_id",
	"summary",
	"details",
] as const;

export interface AuditEntryInput {
	actor: { email: string };
	action: string;
	resourceType: string;
	resourceId?: string | null;
	summary: string;
	details?: Record<string, unknown> | null;
}

export interface AuditEntryBindings {
	userEmail: string;
	action: string;
	resourceType: string;
	resourceId: string | null;
	summary: string;
	details: string | null;
}

export function buildAuditEntry(input: AuditEntryInput): AuditEntryBindings {
	return {
		userEmail: input.actor.email,
		action: input.action,
		resourceType: input.resourceType,
		resourceId: input.resourceId ?? null,
		summary: input.summary,
		details: input.details ? JSON.stringify(input.details) : null,
	};
}

// ---------------------------------------------------------------------------
// Row → domain mappers
// ---------------------------------------------------------------------------

export interface PersistedOverrideRow {
	title: string;
	status: ContentStatus;
	scheduled_at: string | null;
	body: string | null;
	seo_title: string;
	meta_description: string;
	excerpt: string | null;
	og_title: string | null;
	og_description: string | null;
	og_image: string | null;
	canonical_url_override: string | null;
	robots_directive: string | null;
	/** Optional — only the SQLite schema carries a free-form metadata JSON column. */
	metadata?: string | null;
}

export interface PersistedOverrideRecord extends ContentOverride {
	metadata?: Record<string, unknown>;
}

export function mapPersistedOverrideRow(
	row: PersistedOverrideRow | null | undefined,
): PersistedOverrideRecord | null {
	if (!row) return null;

	let metadata: Record<string, unknown> | undefined;
	if (row.metadata) {
		try {
			metadata = JSON.parse(row.metadata) as Record<string, unknown>;
		} catch {
			metadata = undefined;
		}
	}

	return {
		title: row.title,
		status: row.status,
		scheduledAt: row.scheduled_at ?? undefined,
		body: row.body ?? undefined,
		seoTitle: row.seo_title,
		metaDescription: row.meta_description,
		excerpt: row.excerpt ?? undefined,
		ogTitle: row.og_title ?? undefined,
		ogDescription: row.og_description ?? undefined,
		ogImage: row.og_image ?? undefined,
		canonicalUrlOverride: row.canonical_url_override ?? undefined,
		robotsDirective: row.robots_directive ?? undefined,
		...(metadata ? { metadata } : {}),
	};
}

export interface RedirectRuleInput {
	sourcePath: string;
	targetPath: string;
	statusCode: 301 | 302;
}

export function toRedirectRecord(rule: RedirectRuleInput) {
	return {
		id: rule.sourcePath,
		kind: "redirect" as const,
		slug: rule.sourcePath,
		status: "published" as const,
		title: rule.sourcePath,
		metadata: { targetPath: rule.targetPath, statusCode: rule.statusCode },
	};
}

export interface ContentStoreRecordInput {
	slug: string;
	kind?: string | null;
	title: string;
	body?: string;
	status: ContentStatus;
	seoTitle: string;
	metaDescription: string;
	updatedAt: string;
	legacyUrl: string;
	templateKey: string;
	summary?: string;
}

function mapContentRecordKind(record: {
	kind?: string | null;
}): "post" | "page" {
	return record.kind === "post" ? "post" : "page";
}

export function toContentStoreRecord(record: ContentStoreRecordInput) {
	return {
		id: record.slug,
		kind: mapContentRecordKind(record),
		slug: record.slug,
		status: record.status === "review" ? "draft" : record.status,
		title: record.title,
		body: record.body ?? null,
		metadata: {
			seoTitle: record.seoTitle,
			metaDescription: record.metaDescription,
			updatedAt: record.updatedAt,
			legacyUrl: record.legacyUrl,
			templateKey: record.templateKey,
			summary: record.summary ?? "",
		},
	};
}
