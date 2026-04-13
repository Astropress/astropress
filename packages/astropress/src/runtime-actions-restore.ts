import type { Actor } from "./persistence-types";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { recordD1Audit } from "./d1-audit";

/**
 * Tables that support soft-delete undo via this restore action.
 * Must be an exact match — never accept arbitrary user input as a table name.
 */
const RESTORABLE_TABLES = ["authors", "media_assets", "categories", "tags"] as const;
type RestorableTable = (typeof RESTORABLE_TABLES)[number];

export function isRestorableTable(table: string): table is RestorableTable {
  return (RESTORABLE_TABLES as readonly string[]).includes(table);
}

/**
 * Clears `deleted_at` for the given record, effectively undoing a soft delete.
 * Only operates on tables in the RESTORABLE_TABLES allowlist.
 */
export async function restoreRuntimeRecord(
  table: RestorableTable,
  id: number,
  actor: Actor,
  locals?: App.Locals | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Invalid id" };
  }

  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await db
        .prepare(`UPDATE ${table} SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NOT NULL`)
        .bind(id)
        .run();

      /* v8 ignore next 3 */
      if (!result.success) {
        return { ok: false as const, error: "Restore query failed" };
      }

      if ((result.meta?.changes ?? 0) === 0) {
        return { ok: false as const, error: "Record not found or not deleted" };
      }

      await recordD1Audit(locals, actor, "record.restore", table, String(id), `Restored ${table} id=${id}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 3 */
    async () => {
      return { ok: false as const, error: "Restore is not supported on this storage backend" };
    },
  );
}
