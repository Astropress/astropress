/**
 * Shared persistence helpers consumed by both the D1 adapter
 * (packages/astropress/src/d1-*.ts) and the SQLite runtime
 * (packages/astropress/src/sqlite-runtime/*). Dialect-specific SQL stays in
 * each adapter; this module holds only dialect-independent logic.
 */

import type {
	AdminRole,
	AuditEvent,
	ContentOverride,
	ManagedAdminUser,
} from "./persistence-types";

const CONTENT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
const DEFAULT_STATUS: ContentStatus = "published";

function isContentStatus(value: unknown): value is ContentStatus {
	return (CONTENT_STATUSES as readonly string[]).includes(value as string);
}

// ---------------------------------------------------------------------------
// Slug / path normalization
// ---------------------------------------------------------------------------

export function normalizeSlug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "-")
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
	return isContentStatus(input) ? input : DEFAULT_STATUS;
}

// ---------------------------------------------------------------------------
// ID list serialization (author_ids, category_ids, tag_ids columns)
// ---------------------------------------------------------------------------

export function parseIdList(value: string | null | undefined): number[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value ?? "[]");
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
	// typeof-string alone discriminates null/undefined/numbers from the set.
	if (typeof record.status === "string" && !isContentStatus(record.status)) {
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

export function parseMetadataJson(
	raw: string | null | undefined,
): Record<string, unknown> | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw ?? "null");
	} catch {
		return undefined;
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return undefined;
	}
	return parsed as Record<string, unknown>;
}

export function mapPersistedOverrideRow(
	row: PersistedOverrideRow | null | undefined,
): PersistedOverrideRecord | null {
	if (!row) return null;
	const metadata = parseMetadataJson(row.metadata);
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

// ---------------------------------------------------------------------------
// Admin-store list queries (audit events + admin users with pending invites)
// ---------------------------------------------------------------------------
// Both D1 and the local SQLite runtime accept these statements verbatim
// (CURRENT_TIMESTAMP, datetime(), CASE WHEN, EXISTS — all in the shared SQLite
// dialect surface that D1 implements).

export const SQL_LIST_AUDIT_EVENTS =
	"SELECT id, user_email, action, resource_type, resource_id, summary, created_at FROM audit_events ORDER BY datetime(created_at) DESC, id DESC";

export const SQL_LIST_ADMIN_USERS_WITH_INVITE = `SELECT id, email, role, name, active, created_at, EXISTS (SELECT 1 FROM user_invites i WHERE i.user_id = admin_users.id AND i.accepted_at IS NULL AND datetime(i.expires_at) > CURRENT_TIMESTAMP) AS has_pending_invite FROM admin_users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC`;

export interface PersistedAuditEventRow {
	id: number;
	user_email: string;
	action: string;
	resource_type: string;
	resource_id: string | null;
	summary: string;
	created_at: string;
}

const AUDIT_TARGET_TYPES = new Set<AuditEvent["targetType"]>([
	"redirect",
	"comment",
	"content",
]);

function resolveAuditTargetType(value: string): AuditEvent["targetType"] {
	return AUDIT_TARGET_TYPES.has(value as AuditEvent["targetType"])
		? (value as AuditEvent["targetType"])
		: "auth";
}

/**
 * Map an `audit_events` row to an `AuditEvent`. The `idPrefix` distinguishes
 * the originating store (`d1-audit-` vs `sqlite-audit-`) so concurrent stores
 * never collide on synthesized IDs.
 */
export function mapPersistedAuditEvent(args: {
	row: PersistedAuditEventRow;
	idPrefix: string;
}): AuditEvent {
	const { row, idPrefix } = args;
	return {
		id: `${idPrefix}${row.id}`,
		action: row.action,
		actorEmail: row.user_email,
		actorRole: "admin",
		summary: row.summary,
		targetType: resolveAuditTargetType(row.resource_type),
		targetId: row.resource_id ?? `${row.id}`,
		createdAt: row.created_at,
	};
}

export interface PersistedAdminUserRow {
	id: number;
	email: string;
	role: AdminRole;
	name: string;
	active: number;
	created_at: string;
	has_pending_invite: number;
}

export function deriveAdminUserStatus(
	active: number,
	hasPendingInvite: number,
): ManagedAdminUser["status"] {
	if (active !== 1) return "suspended";
	if (hasPendingInvite === 1) return "invited";
	return "active";
}

export function mapPersistedAdminUserRow(
	row: PersistedAdminUserRow,
): ManagedAdminUser {
	return {
		id: row.id,
		email: row.email,
		role: row.role,
		name: row.name,
		active: row.active === 1,
		status: deriveAdminUserStatus(row.active, row.has_pending_invite),
		createdAt: row.created_at,
	};
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
