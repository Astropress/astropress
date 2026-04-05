import { createAstropressRunwaySqliteAdapter } from "./runway-sqlite.js";
import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressSupabaseSqliteAdapter } from "./supabase-sqlite.js";

function normalizeLocalProvider(provider) {
  if (provider === "supabase" || provider === "runway") {
    return provider;
  }
  return "sqlite";
}

export function createAstropressLocalAdapter(options = {}) {
  const provider = normalizeLocalProvider(options.provider ?? process.env.ASTROPRESS_LOCAL_PROVIDER ?? null);
  if (provider === "supabase") {
    return createAstropressSupabaseSqliteAdapter(options);
  }
  if (provider === "runway") {
    return createAstropressRunwaySqliteAdapter(options);
  }
  return createAstropressSqliteAdapter(options);
}
