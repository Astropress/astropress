import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressSupabaseAdapter } from "./supabase.js";

export function createAstropressSupabaseSqliteAdapter(options = {}) {
  return createAstropressSupabaseAdapter({
    backingAdapter: createAstropressSqliteAdapter(options)
  });
}
