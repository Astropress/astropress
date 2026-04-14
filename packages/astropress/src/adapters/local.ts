import type { AstropressPlatformAdapter } from "../platform-contracts";
import { resolveAstropressLocalProviderFromEnv } from "../project-env";
import {
  createAstropressSqliteAdapter,
  type AstropressSqliteAdapterOptions,
} from "./sqlite";
import {
  createAstropressSupabaseSqliteAdapter,
  type AstropressSupabaseSqliteAdapterOptions,
} from "./supabase-sqlite";

export type AstropressLocalProviderKind = "sqlite" | "supabase";

export type AstropressLocalAdapterOptions = AstropressSqliteAdapterOptions & {
  provider?: AstropressLocalProviderKind;
  env?: Record<string, string | undefined>;
};

export function createAstropressLocalAdapter(
  options: AstropressLocalAdapterOptions = {},
): AstropressPlatformAdapter {
  const provider = options.provider ?? resolveAstropressLocalProviderFromEnv(options.env ?? process.env);

  if (provider === "supabase") {
    return createAstropressSupabaseSqliteAdapter(options satisfies AstropressSupabaseSqliteAdapterOptions);
  }

  return createAstropressSqliteAdapter(options);
}
