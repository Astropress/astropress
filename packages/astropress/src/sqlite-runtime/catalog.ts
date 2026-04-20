import { createAstropressAuthorRepository } from "../author-repository-factory";
import type { Actor, SessionUser } from "../persistence-types";
import { createAstropressTaxonomyRepository } from "../taxonomy-repository-factory";
import { recordAudit } from "./audit-log";
import { type AstropressSqliteDatabaseLike, slugifyTerm } from "./utils";

const SQL_INSERT_AUTHOR =
	"INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)";
const SQL_UPDATE_AUTHOR =
	"UPDATE authors SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";
const SQL_DELETE_AUTHOR =
	"UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";

export function createSqliteCatalogStore(
	getDb: () => AstropressSqliteDatabaseLike,
) {
	function listAuthors() {
		const rows = getDb()
			.prepare(
				`
          SELECT id, slug, name, bio, created_at, updated_at
          FROM authors
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `,
			)
			.all() as Array<{
			id: number;
			slug: string;
			name: string;
			bio: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			bio: row.bio ?? undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
	}

	const sqliteAuthorRepository = createAstropressAuthorRepository({
		listAuthors,
		slugifyTerm,
		createAuthor({
			slug,
			name,
			bio,
		}: { slug: string; name: string; bio?: string }) {
			try {
				getDb().prepare(SQL_INSERT_AUTHOR).run(slug, name, bio);
				return true;
			} catch {
				return false;
			}
		},
		updateAuthor({
			id,
			slug,
			name,
			bio,
		}: { id: number; slug: string; name: string; bio?: string }) {
			try {
				const result = getDb()
					.prepare(SQL_UPDATE_AUTHOR)
					.run(slug, name, bio, id);
				return result.changes > 0;
			} catch {
				return false;
			}
		},
		deleteAuthor(id: number) {
			return getDb().prepare(SQL_DELETE_AUTHOR).run(id).changes > 0;
		},
		recordAuthorAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "content", targetId);
		},
	});

	function listTaxonomyTerms(
		table: "categories" | "tags",
		kind: "category" | "tag",
	) {
		const rows = getDb()
			.prepare(
				`
          SELECT id, slug, name, description, created_at, updated_at
          FROM ${table}
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `,
			)
			.all() as Array<{
			id: number;
			slug: string;
			name: string;
			description: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return rows.map((row) => ({
			id: row.id,
			kind,
			slug: row.slug,
			name: row.name,
			description: row.description ?? undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
	}

	const sqliteTaxonomyRepository = createAstropressTaxonomyRepository({
		listCategories() {
			return listTaxonomyTerms("categories", "category");
		},
		listTags() {
			return listTaxonomyTerms("tags", "tag");
		},
		slugifyTerm,
		createTaxonomyTerm({
			table,
			slug,
			name,
			description,
		}: {
			table: "categories" | "tags";
			slug: string;
			name: string;
			description?: string;
		}) {
			try {
				getDb()
					.prepare(
						`INSERT INTO ${table} (slug, name, description) VALUES (?, ?, ?)`,
					)
					.run(slug, name, description);
				return true;
			} catch {
				return false;
			}
		},
		updateTaxonomyTerm({
			table,
			id,
			slug,
			name,
			description,
		}: {
			table: "categories" | "tags";
			id: number;
			slug: string;
			name: string;
			description?: string;
		}) {
			try {
				const result = getDb()
					.prepare(
						`UPDATE ${table} SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
					)
					.run(slug, name, description, id);
				return result.changes > 0;
			} catch {
				return false;
			}
		},
		deleteTaxonomyTerm({
			table,
			id,
		}: { table: "categories" | "tags"; id: number }) {
			return (
				getDb()
					.prepare(
						`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
					)
					.run(id).changes > 0
			);
		},
		recordTaxonomyAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "content", targetId);
		},
	});

	return { sqliteAuthorRepository, sqliteTaxonomyRepository };
}
