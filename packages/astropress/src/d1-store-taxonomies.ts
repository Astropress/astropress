import { slugify } from "./admin-normalizers";
import type { D1AdminMutationStore, D1AdminReadStore } from "./d1-admin-store";
import type { D1DatabaseLike } from "./d1-database";
import type { AuthorRecord, TaxonomyTerm } from "./persistence-types";

export function createD1AuthorsReadPart(
	db: D1DatabaseLike,
): D1AdminReadStore["authors"] {
	return {
		async listAuthors(): Promise<AuthorRecord[]> {
			const rows = (
				await db
					.prepare(
						`
              SELECT id, slug, name, bio, created_at, updated_at
              FROM authors
              WHERE deleted_at IS NULL
              ORDER BY name COLLATE NOCASE ASC, id ASC
            `,
					)
					.all<{
						id: number;
						slug: string;
						name: string;
						bio: string | null;
						created_at: string;
						updated_at: string;
					}>()
			).results;

			return rows.map((row) => ({
				id: row.id,
				slug: row.slug,
				name: row.name,
				bio: row.bio ?? undefined,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		},
	};
}

export function createD1TaxonomiesReadPart(
	db: D1DatabaseLike,
): D1AdminReadStore["taxonomies"] {
	return {
		async listCategories(): Promise<TaxonomyTerm[]> {
			const rows = (
				await db
					.prepare(
						`
              SELECT id, slug, name, description, created_at, updated_at
              FROM categories
              WHERE deleted_at IS NULL
              ORDER BY name COLLATE NOCASE ASC, id ASC
            `,
					)
					.all<{
						id: number;
						slug: string;
						name: string;
						description: string | null;
						created_at: string;
						updated_at: string;
					}>()
			).results;

			return rows.map((row) => ({
				id: row.id,
				kind: "category" as const,
				slug: row.slug,
				name: row.name,
				description: row.description ?? undefined,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		},
		async listTags(): Promise<TaxonomyTerm[]> {
			const rows = (
				await db
					.prepare(
						`
              SELECT id, slug, name, description, created_at, updated_at
              FROM tags
              WHERE deleted_at IS NULL
              ORDER BY name COLLATE NOCASE ASC, id ASC
            `,
					)
					.all<{
						id: number;
						slug: string;
						name: string;
						description: string | null;
						created_at: string;
						updated_at: string;
					}>()
			).results;

			return rows.map((row) => ({
				id: row.id,
				kind: "tag" as const,
				slug: row.slug,
				name: row.name,
				description: row.description ?? undefined,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		},
	};
}

export function createD1AuthorsMutationPart(
	db: D1DatabaseLike,
): D1AdminMutationStore["authors"] {
	return {
		async createAuthor(input) {
			const name = input.name.trim();
			const slug = slugify(input.slug?.trim() || name);
			if (!name || !slug) {
				return {
					ok: false as const,
					error: "Author name and slug are required.",
				};
			}

			try {
				await db
					.prepare("INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)")
					.bind(slug, name, input.bio?.trim() ?? "")
					.run();
			} catch {
				return {
					ok: false as const,
					error: "That author name or slug is already in use.",
				};
			}

			return { ok: true as const };
		},
		async updateAuthor(input) {
			const name = input.name.trim();
			const slug = slugify(input.slug?.trim() || name);
			if (!input.id || !name || !slug) {
				return {
					ok: false as const,
					error: "Author id, name, and slug are required.",
				};
			}

			try {
				await db
					.prepare(
						"UPDATE authors SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
					)
					.bind(slug, name, input.bio?.trim() ?? "", input.id)
					.run();
			} catch {
				return {
					ok: false as const,
					error: "That author name or slug is already in use.",
				};
			}

			return { ok: true as const };
		},
		async deleteAuthor(id) {
			await db
				.prepare(
					"UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
				)
				.bind(id)
				.run();
			return { ok: true as const };
		},
	};
}

function validateTaxonomyInput(
	input: { name: string; slug?: string; id?: number },
	kind: "category" | "tag",
	requireId: boolean,
): { ok: true; name: string; slug: string } | { ok: false; error: string } {
	const name = input.name.trim();
	const slug = slugify(input.slug?.trim() || name);
	if (requireId && !input.id) {
		return { ok: false, error: `${kind} id, name, and slug are required.` };
	}
	if (!name || !slug) {
		return { ok: false, error: `${kind} name and slug are required.` };
	}
	return { ok: true, name, slug };
}

async function upsertTaxonomyTerm(
	db: D1DatabaseLike,
	table: "categories" | "tags",
	kind: "category" | "tag",
	input: { name: string; slug?: string; description?: string; id?: number },
	mode: "create" | "update",
): Promise<{ ok: true } | { ok: false; error: string }> {
	const validated = validateTaxonomyInput(input, kind, mode === "update");
	if (!validated.ok) {
		return { ok: false as const, error: validated.error };
	}
	const desc = input.description?.trim() ?? "";
	try {
		if (mode === "create") {
			await db
				.prepare(
					`INSERT INTO ${table} (slug, name, description) VALUES (?, ?, ?)`,
				)
				.bind(validated.slug, validated.name, desc)
				.run();
		} else {
			await db
				.prepare(
					`UPDATE ${table} SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
				)
				.bind(validated.slug, validated.name, desc, input.id)
				.run();
		}
	} catch {
		return {
			ok: false as const,
			error: `That ${kind} name or slug is already in use.`,
		};
	}
	return { ok: true as const };
}

export function createD1TaxonomiesMutationPart(
	db: D1DatabaseLike,
): D1AdminMutationStore["taxonomies"] {
	return {
		async createCategory(input) {
			return upsertTaxonomyTerm(db, "categories", "category", input, "create");
		},
		async updateCategory(input) {
			return upsertTaxonomyTerm(db, "categories", "category", input, "update");
		},
		async deleteCategory(id) {
			await db
				.prepare(
					"UPDATE categories SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
				)
				.bind(id)
				.run();
			return { ok: true as const };
		},
		async createTag(input) {
			return upsertTaxonomyTerm(db, "tags", "tag", input, "create");
		},
		async updateTag(input) {
			return upsertTaxonomyTerm(db, "tags", "tag", input, "update");
		},
		async deleteTag(id) {
			await db
				.prepare(
					"UPDATE tags SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
				)
				.bind(id)
				.run();
			return { ok: true as const };
		},
	};
}
