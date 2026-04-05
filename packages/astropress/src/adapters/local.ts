import type { AstropressPlatformAdapter } from "../platform-contracts";
import { resolveAstropressLocalProviderFromEnv } from "../project-env";
import {
  createAstropressRunwaySqliteAdapter,
  type AstropressRunwaySqliteAdapterOptions,
} from "./runway-sqlite";
import {
  createAstropressSqliteAdapter,
  type AstropressSqliteAdapterOptions,
} from "./sqlite";
import {
  createAstropressSupabaseSqliteAdapter,
  type AstropressSupabaseSqliteAdapterOptions,
} from "./supabase-sqlite";

export type AstropressLocalProviderKind = "sqlite" | "supabase" | "runway";

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

  if (provider === "runway") {
    return createAstropressRunwaySqliteAdapter(options satisfies AstropressRunwaySqliteAdapterOptions);
  }

  return createAstropressSqliteAdapter(options);
}
