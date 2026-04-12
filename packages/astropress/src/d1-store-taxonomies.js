import { slugify } from "./admin-normalizers.js";

export function createD1AuthorsReadPart(db) {
  return {
    async listAuthors() {
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
          .all()
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

export function createD1TaxonomiesReadPart(db) {
  return {
    async listCategories() {
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
          .all()
      ).results;

      return rows.map((row) => ({
        id: row.id,
        kind: "category",
        slug: row.slug,
        name: row.name,
        description: row.description ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    async listTags() {
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
          .all()
      ).results;

      return rows.map((row) => ({
        id: row.id,
        kind: "tag",
        slug: row.slug,
        name: row.name,
        description: row.description ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  };
}

export function createD1AuthorsMutationPart(db) {
  return {
    async createAuthor(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!name || !slug) {
        return { ok: false, error: "Author name and slug are required." };
      }
      try {
        await db.prepare("INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)").bind(slug, name, input.bio?.trim() ?? "").run();
      } catch {
        return { ok: false, error: "That author name or slug is already in use." };
      }
      return { ok: true };
    },
    async updateAuthor(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!input.id || !name || !slug) {
        return { ok: false, error: "Author id, name, and slug are required." };
      }
      try {
        await db
          .prepare("UPDATE authors SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
          .bind(slug, name, input.bio?.trim() ?? "", input.id)
          .run();
      } catch {
        return { ok: false, error: "That author name or slug is already in use." };
      }
      return { ok: true };
    },
    async deleteAuthor(id) {
      await db.prepare("UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").bind(id).run();
      return { ok: true };
    },
  };
}

export function createD1TaxonomiesMutationPart(db) {
  return {
    async createCategory(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!name || !slug) {
        return { ok: false, error: "category name and slug are required." };
      }
      try {
        await db.prepare("INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)").bind(slug, name, input.description?.trim() ?? "").run();
      } catch {
        return { ok: false, error: "That category name or slug is already in use." };
      }
      return { ok: true };
    },
    async updateCategory(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!input.id || !name || !slug) {
        return { ok: false, error: "category id, name, and slug are required." };
      }
      try {
        await db
          .prepare("UPDATE categories SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
          .bind(slug, name, input.description?.trim() ?? "", input.id)
          .run();
      } catch {
        return { ok: false, error: "That category name or slug is already in use." };
      }
      return { ok: true };
    },
    async deleteCategory(id) {
      await db.prepare("UPDATE categories SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").bind(id).run();
      return { ok: true };
    },
    async createTag(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!name || !slug) {
        return { ok: false, error: "tag name and slug are required." };
      }
      try {
        await db.prepare("INSERT INTO tags (slug, name, description) VALUES (?, ?, ?)").bind(slug, name, input.description?.trim() ?? "").run();
      } catch {
        return { ok: false, error: "That tag name or slug is already in use." };
      }
      return { ok: true };
    },
    async updateTag(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug?.trim() || name);
      if (!input.id || !name || !slug) {
        return { ok: false, error: "tag id, name, and slug are required." };
      }
      try {
        await db
          .prepare("UPDATE tags SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
          .bind(slug, name, input.description?.trim() ?? "", input.id)
          .run();
      } catch {
        return { ok: false, error: "That tag name or slug is already in use." };
      }
      return { ok: true };
    },
    async deleteTag(id) {
      await db.prepare("UPDATE tags SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").bind(id).run();
      return { ok: true };
    },
  };
}
