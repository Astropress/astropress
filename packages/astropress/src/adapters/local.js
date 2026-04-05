import { resolveAstropressLocalProviderFromEnv } from "../project-env.js";
import { createAstropressRunwaySqliteAdapter } from "./runway-sqlite.js";
import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressSupabaseSqliteAdapter } from "./supabase-sqlite.js";

export function createAstropressLocalAdapter(options = {}) {
  const provider = options.provider ?? resolveAstropressLocalProviderFromEnv(options.env ?? process.env);
  if (provider === "supabase") {
    return createAstropressSupabaseSqliteAdapter(options);
  }
  if (provider === "runway") {
    return createAstropressRunwaySqliteAdapter(options);
  }
  return createAstropressSqliteAdapter(options);
}
