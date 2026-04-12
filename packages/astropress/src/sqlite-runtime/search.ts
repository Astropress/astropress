import type { AstropressSqliteDatabaseLike } from "./utils";
import type { ContentRecord } from "../persistence-types";

/**
 * Search content_overrides using the FTS5 virtual table.
 * Requires ensureFts5SearchIndex to have been called at boot.
 */
export function searchContentOverrides(db: AstropressSqliteDatabaseLike, query: string): ContentRecord[] {
  return db
    .prepare(
      `SELECT co.* FROM content_overrides co
       WHERE co.rowid IN (SELECT rowid FROM content_fts(?) ORDER BY rank)`,
    )
    .all(query) as ContentRecord[];
}
