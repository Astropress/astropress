import { createAstropressTaxonomyRepository } from "../taxonomy-repository-factory.js";
import { createAstropressAuthorRepository } from "../author-repository-factory.js";
import { slugifyTerm } from "./utils.js";

function createSqliteCatalogStore(getDb) {
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

  function listAuthors() {
    const rows = getDb().prepare(`
          SELECT id, slug, name, bio, created_at, updated_at
          FROM authors
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      /* v8 ignore next 1 */
      bio: row.bio ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  const sqliteAuthorRepository = createAstropressAuthorRepository({
    listAuthors,
    slugifyTerm,
    createAuthor({ slug, name, bio }) {
      try {
        getDb().prepare(`
              INSERT INTO authors (slug, name, bio)
              VALUES (?, ?, ?)
            `).run(slug, name, bio);
        return true;
      } catch {
        return false;
      }
    },
    updateAuthor({ id, slug, name, bio }) {
      try {
        const result = getDb().prepare(`
              UPDATE authors
              SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND deleted_at IS NULL
            `).run(slug, name, bio, id);
        return result.changes > 0;
      /* v8 ignore next 3 */
      } catch {
        return false;
      }
    },
    deleteAuthor(id) {
      return getDb().prepare("UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").run(id).changes > 0;
    },
    recordAuthorAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  function listTaxonomyTerms(table, kind) {
    const rows = getDb().prepare(`
          SELECT id, slug, name, description, created_at, updated_at
          FROM ${table}
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      kind,
      slug: row.slug,
      name: row.name,
      /* v8 ignore next 1 */
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
    createTaxonomyTerm({ table, slug, name, description }) {
      try {
        getDb().prepare(`INSERT INTO ${table} (slug, name, description) VALUES (?, ?, ?)`).run(slug, name, description);
        return true;
      } catch {
        return false;
      }
    },
    updateTaxonomyTerm({ table, id, slug, name, description }) {
      try {
        const result = getDb().prepare(`UPDATE ${table} SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).run(slug, name, description, id);
        return result.changes > 0;
      /* v8 ignore next 3 */
      } catch {
        return false;
      }
    },
    deleteTaxonomyTerm({ table, id }) {
      return getDb().prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).run(id).changes > 0;
    },
    recordTaxonomyAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  return { sqliteAuthorRepository, sqliteTaxonomyRepository };
}

export { createSqliteCatalogStore };
